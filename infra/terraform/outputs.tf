output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "frontend_url" {
  description = "Public SPA URL (the deliverable)"
  value       = "https://${azurerm_container_app.web.ingress[0].fqdn}"
}

output "api_url" {
  description = "Public API base URL"
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "google_redirect_uri" {
  description = "Register this in the Google OAuth client (Authorized redirect URIs)"
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}/api/auth/google/callback"
}

output "google_js_origin" {
  description = "Register this in the Google OAuth client (Authorized JavaScript origins)"
  value       = "https://${azurerm_container_app.web.ingress[0].fqdn}"
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}
