# kaholo-plugin-GCCE
Google Cloud Compute Engine (GCCE) plugin for Kaholo.

This plugin requires the following APIs to be enabled for your project(s) in the Google Cloud Platform:

>**Google Cloud Compute Engine API**

>**Identity and Access Management (IAM) API** *

If you enabled an API recently, a few minutes may be required for the action to propagate to the systems and become fully effective.

\* The IAM API is needed only for autocomplete functionality of parameters Api Access Service Account and Service Account Access Scopes in method Launch VM.

## Installation
For download, installation, upgrade, downgrade and troubleshooting of plugins in general, see [INSTALL.md](https://github.com/Kaholo/kaholo-plugin-GoogleCloudComputeEngine/blob/master/INSTALL.md).

## Settings
Plugin settings act as default parameter values. If configured in plugin settings, the action parameters may be left unconfigured. This is an optional convenience. Action parameters configured anyway over-ride the plugin-level settings for that parameter.
* Default Service Account Credentials (Vault) - A Vaulted JSON document containing service account credentials as provided by GCP. [Tutorial](https://cloud.google.com/iam/docs/creating-managing-service-account-keys).
* Default Project (String) - A GCP Project defines how your app interacts with services and resources.
* Default Region (String) - The geographical GCP region where infrastructure is or will be located, i.e. asia-southeast1.
* Default Disk Auto Delete - If enabled, disks created with VMs will be deleted as well if the VM is deleted. Used only in method Launch VM.
* Default Wait For Operation End - If enabled, Kaholo will wait for the Action to complete before moving along to the next Action in the Pipeline.

## Method: Launch VM
Method Launch VM creates a new virtual machine instance. The underlying Google Cloud API method is described [here](https://cloud.google.com/compute/docs/reference/rest/v1/instances/insert).

### Parameters
Required parameters have an asterisk (*) next to their names.
* Service Account Credentials * - as described above in plugin settings
* Project * - as described above in plugin settings
* Name * - a name for the new VM instance
* Description - A description for the new VM instance
* Region - as described above in plugin settings
* Zone * - Zone is a subdivision of GCP regions, typically region-a, b, or c.
* Machine Type * - Machine Type determines type/quantity of vCPU, RAM, other features, and price, e.g. `e2-micro`
* Custom Machine CPU Count (only for custom machine types) - The desired number of vCPUs, e.g. `2`.
* Custom Machine Memory (only for custom machine types) - The amount of RAM in MB, e.g. `2048`.
* Image Project - The GCP project that contains the image you want to use for the boot disk of the new VM instance. Used only for autocompletion of the Image paramter.
* Image * - The image you want to use for the boot disk of the new VM instance. This determines among other details which operating system is installed on the VM.
* Boot Disk Type - The type of disk to use for the boot disk - `PD-Standard`, `PD-Balanced`, `PD-SSD`, or `Local SSD`. The default value if not configured is `PD-Standard`.
* Boot Disk Size (GB) - The size of the boot disk. Default value is `10` GB.
* Disk Auto Delete - If enabled, when the new VM is deleted the disk will be also.
* Api Access Service Account - Provide the VM access to an API access service account.
* Service Account Access Scopes - Choose which level of access to grant the VM: `Allow default access` or `Allow full access to all Cloud APIs`.
* Firewall - Allow HTTP traffic - If enabled, the VM is network tagged as `http-server` to allow inbound HTTP traffic.
* Firewall - Allow HTTPS traffic - If enabled, the VM is network tagged as `https-server` to allow inbound HTTPS traffic.
* VPC Network Name * - The name of a VPC Network in the project with subnets in the specified region.
* Subnet * - The name of a subnet within the VPC Network for the VM's default network interface.
* Custom Internal IP - If selected, assign this specified internal IP address for the new VM instance. Must be a valid IP address in the range of IP addresses of the subnet to host the VM instance.
* Additional Network Interfaces - If selected, add additional network interfaces to the VM instance. Each interface must belong to a separate subnet. The format is an array, for example:

`[{network: 'https://www.googleapis.com/compute/v1/projects/gcp-proj-a/global/networks/vpc-net-a', subnetwork: 'https://www.googleapis.com/compute/v1/projects/gcp-proj-a/regions/asia-southeast1/subnetworks/sub-a', networkIP: '10.55.27.103'}]`
* Can IP Forward - If enabled, the VM instance can forward packets like a network device, e.g. NAT, router or firewall. Otherwise Google will block through packets due to strict source/destination checking.
* Preemptible - If enabled, the VM will be a discount-priced instance that may be arbitrarily deleted by GCP prematurely, or with 24 hours maximum.
* Tags - Network Tags associate Vms with firewall rules and routes with the same tag or tags. To enter multpile values seprate each with a new line.
* Labels - The `key=value` labels to assign to the new VM. To enter multpile values seprate each with a new line.
* Wait For Operation End - as described above in plugin settings 
* Auto Create Static External IP Address - If selected, the external IP address is reserved so it does not change or get released even if the VM is deleted.

## Method: VM Action
Performs any of several operations on a specified VM. These actions include:
* Stop - Stops the VM.
* Start - Starts the VM.
* Restart - Stops and then Starts the VM.
* Get - Return a large collection of information about the VM instance as a JSON document in the Kaholo Execution Results Page, accessible by code as `kaholo.actions.<id of the get action>.result`
* Get External IP - Similar to Get, but returns simply the external IP address of the VM instance as string.
* Delete - Delete the VM instance.

### Parameters
* Service Account Credentials * - as described above in plugin settings
* Project * - as described above in plugin settings
* Region - as described above in plugin settings
* Zone * - Zone is a subdivision of GCP regions, typically region-a, b, or c.
* VM Instance - The name of the VM instance on which to perform the action.
* Action * - The action to perform: `Stop`, `Start`, `Restart`, `Get`, `Get External IP`, or `Delete`
* Wait For Operation End - as described above in plugin settings

## Method: Create VPC Network
Create a new Virtual Private Cloud (VPC) network. 

### Parameters
* Service Account Credentials * - as described above in plugin settings
* Project * - as described above in plugin settings
* Network Name * - a unique name for the new VPC network.
* Description - a description of the new network.
* Auto Create Subnets - If selected, automatically creates one default subnet in every geographical region.
* Wait For Operation End - as described above in plugin settings

## Method: Create Subnet
Create a new subnet inside the specified VPC network. Unlike VPC networks, each subnet is located in one specific geographical region.

### Parameters
* Service Account Credentials * - as described above in plugin settings.
* Project * - as described above in plugin settings
* VPC Network Name * - the VPC network in which the subnet is to be created
* Subnet Name * - a unique name for the new subnet
* Description - a description of the new subnet
* Region * - as described above in plugin settings
* IP Range * - CIDR notataion IP address range for the new subnet. For example 10.55.25.0/24.
8. Private Google API Access - If selected, allow VM instances inside the new subnet to access any google API.
9. Flow Logs - If selected, record subnet traffic to flow logs for network monitoring, forensics, real-time security analysis, and expense optimization.
* Wait For Operation End - as described above in plugin settings.

## Method: Reserve Private IP Address
Creates a reservation for the specified internal IP address on the specified subnet. This prevents the address from being arbitrarily assigned, for example to a new VM.

### Parameters
* Service Account Credentials * - as described above in plugin settings.
* Project * - as described above in plugin settings
* VPC Network Name * - the VPC network in which the reservation is to be created
* Region * - as described above in plugin settings
* Subnet Name * - the subnet in which the reservation is to be created
* Reserve name * - a name for the reservation.
* IP To Reserve * - the IP address to reserve. This must fall within the defined CIDR address space of the subnet.
* Wait For Operation End - as described above in plugin settings.

## Method: Create Firewall Rule
Creates a new firewall rule for the specified VPC network. Rules can contain ranges of IP addresses and ports, but each rule must be for either all traffic or one specified protocol and either ingress or egress. Create multiple rules if necessary to cover all combinations of protocol and ingress/egress requried. **The defaults are very permissive** - if none of the optional parameters are specified, the method creates by default a rule that allows all traffic from everywhere into the subnet. This is for Kaholo user convenience only, not an advisable security practice.

Rules are associated to routes and VM instances by means of Network Tags. For example a firewall rule to allow TCP ingress on port 443 (HTTPS) tagged "web-server" would allow only VM instances also tagged "web-server" to receive HTTPS web traffic. Firewall rules with no tags apply to every VM instance in the VPC network.

### Parameters
* Service Account Credentials * - as described above in plugin settings.
* Project * - as described above in plugin settings
* VPC Network Name * - the VPC network in which the firewall rule is to be created
* Firewall Name * - A name for the new firewall rule.
* Priority - The priority of the new firewall rule. Default is 1000
    * 0 = highest priority
    * 65535 = lowest priority
* Direction - The direction of the firewall rule. Possible values:
    * Ingress - filter incoming network traffic (default)
    * Egress - filter outgoing network traffic
* Action - typically there's a catch-all deny rule and higher priority allow rules for a list of exceptions.
    * Allow - permit traffic that matches the rule (default)
    * Deny - block traffic that matches the rule
* Ip Range Filter - The IP ranges the new firewall rule will be applied to. The default is 0.0.0.0/0 - *every* IP address.
* Protocol - Which protocol the rules apply to if not all.
    * All - rule applies to every protocol, every port
    * AH, ESP, IPIP - no ports required
    * ICMP - typically used to allow ping, no ports required 
    * SCTP, UDP - ports are typically specified for these
    * TCP - the most commonly specified protocol, also used with ports
* Ports - Port or port ranges to match for firewall rules using TCP, UDP, or SCTP. Enter one port or port range per line, no commas. If not defined the rule matches every port. Commonly used examples with TCP include:
    * no port specified - allow every TCP port
    * `22` - SSH (Linux)
    * `80` - HTTP
    * `443` - HTTPS
    * `3389` - Remote Desktop (Windows)
    * `1025-65535` - Range matching all ephemeral addresses
* Wait For Operation End - as described above in plugin settings.
* Tags - Network tags to to associate the firewall rule with similarly tagged VM instances.

## Method: Create Route
Create a new route inside the specified network. This directs traffic both between subnets and peering with internet gateways, VPN tunnels, load balancers, firewall instances and such. Like firewall rules, routes also accept network tags. Network tags are used to match routes with VM instances that bear the same network tag. For example a route to the internet gateway tagged "internet" would allow only VM instances also tagged "internet" access to the internet. Routes with no tags apply to every VM instance in the VPC network.

### Parameters
* Service Account Credentials * - as described above in plugin settings.
* Project * - as described above in plugin settings
* VPC Network Name * - the VPC network in which the route is to be created
* Route Name * - The name of the new route.
* Next Hop IP * - The route's destination IP address, aka gateway address.
* Dest IP Range * - The range of destination IP addresses in CIDR notation to which this route applies.
* Priority - The priority of the new route. Default is 1000
    * 0 = highest priority
    * 65535 = lowest priority
* Tags - Network tags to to associate the route with similarly tagged VM instances.
* Wait For Operation End - as described above in plugin settings.
