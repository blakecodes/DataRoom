variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "tenant_id" {
  description = "Azure AD tenant (directory) ID"
  type        = string
}

variable "location" {
  description = "Azure region for app resources"
  type        = string
  default     = "eastus"
}

variable "postgres_location" {
  description = "Azure region for Postgres (separate because some regions are offer-restricted)"
  type        = string
  default     = "westus3"
}

variable "project" {
  description = "Short project name used in resource names"
  type        = string
  default     = "dataroom"
}

variable "postgres_admin" {
  description = "Postgres administrator login"
  type        = string
  default     = "dataroom"
}

# Google OAuth — supplied via terraform.tfvars (gitignored) or TF_VAR_*.
variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_api_key" {
  description = "Google browser API key for the Picker (baked into the SPA build)"
  type        = string
  default     = ""
}
