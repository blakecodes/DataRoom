locals {
  name           = var.project
  api_app_name   = "${var.project}-api"
  web_app_name   = "${var.project}-web"
  worker_app     = "${var.project}-worker"
  redis_app      = "${var.project}-redis"
  blob_container = "dataroom-files"
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "random_string" "pg_suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "random_password" "postgres" {
  length  = 28
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

resource "random_password" "app_secret" {
  length  = 48
  special = false
}

resource "random_password" "encryption_key" {
  length  = 44
  special = false
}

# --- Resource group (new) ---
resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}"
  location = var.location
}

# --- Observability + Container Apps environment ---
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.project}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${var.project}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# --- Container registry ---
resource "azurerm_container_registry" "main" {
  name                = "acr${var.project}${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
}

# --- Blob storage ---
resource "azurerm_storage_account" "main" {
  name                     = "st${var.project}${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

resource "azurerm_storage_container" "files" {
  name                  = local.blob_container
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = "private"
}

# --- Postgres Flexible Server ---
resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "psql-${var.project}-${random_string.pg_suffix.result}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = var.postgres_location
  version                       = "16"
  administrator_login           = var.postgres_admin
  administrator_password        = random_password.postgres.result
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  public_network_access_enabled = true
  zone                          = "1"

  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "dataroom"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Demo-only: allow all IPs. Tighten to specific egress ranges / private endpoint for prod.
resource "azurerm_postgresql_flexible_server_firewall_rule" "all" {
  name             = "allow-all-demo"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "255.255.255.255"
}

# --- Derived values (FQDNs are deterministic from the env default domain) ---
locals {
  default_domain = azurerm_container_app_environment.main.default_domain
  api_fqdn       = "${local.api_app_name}.${local.default_domain}"
  web_fqdn       = "${local.web_app_name}.${local.default_domain}"
  api_base_url   = "https://${local.api_fqdn}"
  web_base_url   = "https://${local.web_fqdn}"

  database_url = "postgresql://${var.postgres_admin}:${random_password.postgres.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
  redis_url    = "redis://${local.redis_app}:6379/0"

  storage_connection_string = azurerm_storage_account.main.primary_connection_string
  blob_public_endpoint      = azurerm_storage_account.main.primary_blob_endpoint
}

# --- Build & push images to ACR (cloud build, no local docker push needed) ---
resource "null_resource" "build_backend" {
  triggers   = { always = timestamp() }
  depends_on = [azurerm_container_registry.main]

  provisioner "local-exec" {
    command = "az acr build --registry ${azurerm_container_registry.main.name} --image backend:latest ${path.module}/../../backend"
  }
}

resource "null_resource" "build_frontend" {
  triggers   = { always = timestamp() }
  depends_on = [azurerm_container_registry.main, azurerm_container_app_environment.main]

  provisioner "local-exec" {
    command = "az acr build --registry ${azurerm_container_registry.main.name} --image web:latest --build-arg VITE_API_BASE=${local.api_base_url}/api --build-arg VITE_GOOGLE_CLIENT_ID=${var.google_client_id} --build-arg VITE_GOOGLE_API_KEY=${var.google_api_key} ${path.module}/../../frontend"
  }
}

# --- Redis (internal TCP service for the import queue) ---
resource "azurerm_container_app" "redis" {
  name                         = local.redis_app
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 1
    container {
      name   = "redis"
      image  = "redis:7"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = false
    transport        = "tcp"
    target_port      = 6379
    exposed_port     = 6379
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# --- API ---
resource "azurerm_container_app" "api" {
  name                         = local.api_app_name
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  depends_on                   = [null_resource.build_backend, azurerm_postgresql_flexible_server_database.main]

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }
  secret {
    name  = "database-url"
    value = local.database_url
  }
  secret {
    name  = "storage-connection"
    value = local.storage_connection_string
  }
  secret {
    name  = "jwt-secret"
    value = random_password.jwt_secret.result
  }
  secret {
    name  = "app-secret"
    value = random_password.app_secret.result
  }
  secret {
    name  = "encryption-key"
    value = random_password.encryption_key.result
  }
  secret {
    name  = "google-client-secret"
    value = var.google_client_secret
  }

  template {
    # Force a fresh revision (and image re-pull) whenever the backend image rebuilds.
    revision_suffix = "b${substr(sha1(null_resource.build_backend.id), 0, 10)}"
    min_replicas    = 1
    max_replicas    = 2

    container {
      name    = "api"
      image   = "${azurerm_container_registry.main.login_server}/backend:latest"
      cpu     = 0.5
      memory  = "1Gi"
      command = ["/bin/bash", "-c", "alembic upgrade head && exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 wsgi:app"]

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }
      env {
        name        = "SECRET_KEY"
        secret_name = "app-secret"
      }
      env {
        name        = "APP_ENCRYPTION_KEY"
        secret_name = "encryption-key"
      }
      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "storage-connection"
      }
      env {
        name        = "GOOGLE_CLIENT_SECRET"
        secret_name = "google-client-secret"
      }
      env {
        name  = "REDIS_URL"
        value = local.redis_url
      }
      env {
        name  = "BLOB_CONTAINER"
        value = local.blob_container
      }
      env {
        name  = "BLOB_PUBLIC_ENDPOINT"
        value = "${local.blob_public_endpoint}${local.blob_container}"
      }
      env {
        name  = "FRONTEND_ORIGIN"
        value = local.web_base_url
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "GOOGLE_REDIRECT_URI"
        value = "${local.api_base_url}/api/auth/google/callback"
      }
      env {
        name  = "FLASK_ENV"
        value = "production"
      }
      env {
        name  = "REFRESH_COOKIE_SECURE"
        value = "true"
      }
      env {
        name  = "REFRESH_COOKIE_SAMESITE"
        value = "None"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

# --- Worker (no ingress; reuses backend image with worker entrypoint) ---
resource "azurerm_container_app" "worker" {
  name                         = local.worker_app
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  depends_on                   = [null_resource.build_backend, azurerm_postgresql_flexible_server_database.main]

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }
  secret {
    name  = "database-url"
    value = local.database_url
  }
  secret {
    name  = "storage-connection"
    value = local.storage_connection_string
  }
  secret {
    name  = "encryption-key"
    value = random_password.encryption_key.result
  }
  secret {
    name  = "google-client-secret"
    value = var.google_client_secret
  }

  template {
    revision_suffix = "b${substr(sha1(null_resource.build_backend.id), 0, 10)}"
    min_replicas    = 1
    max_replicas    = 1

    container {
      name = "worker"
      # 1 vCPU / 2Gi: RQ forks a work-horse per job, which transiently doubles
      # the (Flask + SQLAlchemy + Azure/Google SDK) footprint. 1Gi OOM-killed it.
      image   = "${azurerm_container_registry.main.login_server}/backend:latest"
      cpu     = 1.0
      memory  = "2Gi"
      command = ["python", "worker.py"]

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "APP_ENCRYPTION_KEY"
        secret_name = "encryption-key"
      }
      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "storage-connection"
      }
      env {
        name        = "GOOGLE_CLIENT_SECRET"
        secret_name = "google-client-secret"
      }
      env {
        name  = "REDIS_URL"
        value = local.redis_url
      }
      env {
        name  = "BLOB_CONTAINER"
        value = local.blob_container
      }
      env {
        name  = "BLOB_PUBLIC_ENDPOINT"
        value = "${local.blob_public_endpoint}${local.blob_container}"
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
    }
  }
}

# --- Frontend (nginx SPA) ---
resource "azurerm_container_app" "web" {
  name                         = local.web_app_name
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  depends_on                   = [null_resource.build_frontend]

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }

  template {
    revision_suffix = "b${substr(sha1(null_resource.build_frontend.id), 0, 10)}"
    min_replicas    = 1
    max_replicas    = 2

    container {
      name   = "web"
      image  = "${azurerm_container_registry.main.login_server}/web:latest"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 80
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}
