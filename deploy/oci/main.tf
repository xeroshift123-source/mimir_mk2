terraform {
  required_version = ">= 1.6"
  required_providers {
    oci = { source = "oracle/oci", version = ">= 6.0, < 9.0" }
  }
}

provider "oci" {
  region              = var.region
  config_file_profile = var.oci_profile
}

variable "region" { type = string }
variable "tenancy_ocid" { type = string }
variable "compartment_ocid" { type = string }
variable "oci_profile" {
  type    = string
  default = "DEFAULT"
}
variable "ssh_public_key" { type = string }
variable "ssh_source_cidr" {
  type        = string
  description = "Your administrator public IPv4 /32; never use an unrestricted CIDR."
  validation {
    condition     = can(cidrhost(var.ssh_source_cidr, 0)) && endswith(var.ssh_source_cidr, "/32")
    error_message = "Use the administrator's single IPv4 address with /32."
  }
}
variable "shape" {
  type    = string
  default = "VM.Standard.A1.Flex"
}
variable "ocpus" {
  type    = number
  default = 1
}
variable "memory_gbs" {
  type    = number
  default = 6
}
variable "publish_web" {
  type        = bool
  default     = false
  description = "Keep false until the later domain cutover."
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}
resource "oci_core_vcn" "mk2" {
  compartment_id = var.compartment_ocid
  cidr_block     = "10.82.0.0/16"
  display_name   = "mimir-mk2"
  dns_label      = "mimirmk2"
}
resource "oci_core_internet_gateway" "mk2" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.mk2.id
  display_name   = "mimir-mk2"
}
resource "oci_core_route_table" "mk2" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.mk2.id
  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.mk2.id
  }
}
resource "oci_core_security_list" "mk2" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.mk2.id
  display_name   = "mimir-mk2"
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }
  ingress_security_rules {
    protocol = "6"
    source   = var.ssh_source_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }
  dynamic "ingress_security_rules" {
    for_each = var.publish_web ? [80, 443] : []
    content {
      protocol = "6"
      source   = "0.0.0.0/0"
      tcp_options {
        min = ingress_security_rules.value
        max = ingress_security_rules.value
      }
    }
  }
}
resource "oci_core_subnet" "mk2" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.mk2.id
  cidr_block        = "10.82.1.0/24"
  route_table_id    = oci_core_route_table.mk2.id
  security_list_ids = [oci_core_security_list.mk2.id]
  display_name     = "mimir-mk2"
}
resource "oci_core_instance" "mk2" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = "mimir-mk2"
  shape               = var.shape
  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gbs
  }
  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs  = 50
  }
  create_vnic_details {
    subnet_id        = oci_core_subnet.mk2.id
    assign_public_ip = true
  }
  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(file("${path.module}/../bootstrap-ubuntu.sh"))
  }
  instance_options { are_legacy_imds_endpoints_disabled = true }
}
output "public_ip" { value = oci_core_instance.mk2.public_ip }
output "ssh_tunnel" {
  value = "ssh -L 8080:127.0.0.1:8080 ubuntu@${oci_core_instance.mk2.public_ip}"
}
