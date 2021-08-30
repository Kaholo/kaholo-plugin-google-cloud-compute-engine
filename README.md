# kaholo-plugin-GCCE
Google Cloud Compute Engine (GCCE) plugin for Kaholo.

* **Make sure to enable the compute API on google cloud.**

## Settings
1. Service Account Credentials (Vault) **Required if not in method** - Default credentials for authenticating to the google cloud API. Needs to be saved in the format of a json object or a string representing it.
2. Default Project ID (String) **Required if not in method** - The ID of the default project to use the methods on.

## Method: Launch VM
Launch a new virtual machine instance. You can find more on the method used from the Google Cloud API [here](https://cloud.google.com/compute/docs/reference/rest/v1/instances/insert).

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project to launch the new VM inside. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. Name (String) **Required** - The name of the VM instance to launch.
4. Description (Text) **Optional** - The description of the VM instance.
5. Region (Autocomplete) **Required** - The Region of the zone to launch the new VM inside.
6. Zone (Autocomplete) **Required** - The zone to launch the new VM inside.
7. Machine Type (Autocomplete) **Required** - The type of virtual machine to run. Determines the CPU architecture, core count, and RAM memory size.
8. Custom Machine CPU Count (Integer) **Required for custom machine types** - If specified a custom nachine type, the number of cpu cores to provide for the new VM instance.
9. Custom Machine Memory(In MB) (Integer) **Required  for custom machine types** - If specified a custom nachine type, the size of RAM memory to provide for the new VM instance.
10. Image Project (Autocomplete) **Required for 'Image' autocomplete** - The project that contains the image you want to use for the boot disk of the new VM instance.
11. Image (Autocomplete) **Required** - The image you want to use for the boot disk of the new VM instance.
12. Boot Disk Type (Options) **Optional** - The type of disk to use for the boot disk. **Possible values: PD-Standard | PD-Balanced | PD-SSD | Local SSD**. Default value is PD-Standard.
13. Boot Disk Size(In GB) (Integer) **Optional** - The size of the boot disk. Default value is 10.
14. Disk Auto Delete (Boolean) **Optional** - Whether to delete the disk automatically when the vm is deleted. Default value is false.
15. Api Access Service Account (Autocomplete) **Optional** - If specified, give access to the specified service account to the new VM. **You need access to the "Identity and Access Management (IAM) API" to use autocomplete in this parameter!**
16. Service Account Access Scopes (Options) **Required if specified 'Api Access Service Account'** - Possible values: Allow default access | Allow full access to all Cloud APIs
17. Firewall - Allow HTTP traffic (Boolean) **Optional** - If specified, create a new firewall rule for the new VM instance to allow HTTP traffic inside(Ingress).
18. Firewall - Allow HTTPS traffic (Boolean) **Optional** - If specified, create a new firewall rule for the new VM instance to allow HTTPS traffic inside(Ingress).
19. VPC Network (Autocomplete) **Optional** - If specified, host the VM instance in a subnetwork from the specified VPC network.
20. Subnetwork (Autocomplete) **Optional** - If specified, host the VM instance in the specified subnetwork.
21. Custom Internal IP (String) **Optional** - If specified, reserve the specified internal IP address for the new VM instance. Must be a valid IP address in the range of IP addresses of the subnetwork to host the VM instance.
22. Additional Network Interfaces (Object) **Optional** - If specified, add the specified network interfaces to the VM instance. You can see more information on the format required for the object, in the documentation of the API method [here](https://cloud.google.com/compute/docs/reference/rest/v1/instances/insert).
23. Can IP Forward (Boolean) **Optional** - If specified, Allows this instance to send and receive packets with non-matching destination or source IPs. This is required if you plan to use this instance to forward routes. Default value is false.
24. Preemptible (Boolean) **Optional** - Defines whether the instance is preemptible. This can only be set during instance creation or while the instance is stopped and therefore, in a TERMINATED state. Default value is false.
25. Tags (Text/Array) **Optional** - The tags to use to tag this instance. To enter multpile values seprate each with a new line.
26. Labels (Text/Object) **Optional** - The labels to attacg to this instance. **Must be in the format of Key=Value**. To enter multpile values seprate each with a new line.
27. Wait For Operation End (Boolean) **Optional** - If specified, wait until the VM instance is in ready state before returning. 
28. Auto Create Static IP Address (Boolean) **Optional** - If specified, create a new external IP address for this instance and associate it with it. **Please make sure when you delete the instance to also release the address**.

## Method: VM Action
Perform the specified action the specified VM instance. Possible actions are:
* Stop - Stops the VM instance in the case it is running.
* Start - Starts the VM instance in the case it is stopeed.
* Restart - Restart the vm instance.
* Get - Return all information about the VM instance.
* Get External IP - Return only the external IP address of the VM instance.
* Delete - Delete the VM instance.

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project of the VM instance. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. Region (Autocomplete) **Required** - The region of the zone hosting the VM instance.
4. Zone (Autocomplete) **Required** - The zone hosting the VM instance.
5. VM Instance (Autocomplete) **Required** -  The VM instance to perform the action on.
6. Action (Options) **Required** - The action to run on the VM instance. Possible values: Stop | Start | Restart | Get | Get External IP | Delete
7. Wait For Operation End (Boolean) **Optional** - If specified, wait until the action is finished.

## Method: Create VPC Network
Create a new VPC network.

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project to create the network inside. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. Network Name (String) **Required** - The name of the network to create.
4. Description (Text) **Optional** - The description of the new network.
5. Auto Create Subnetworks (Boolean) **Optional** - If specified, let google cloud automatically create some subnetworks on the creation of the new network, inside it.
6. Wait For Operation End (Boolean) **Optional** - If specified, wait until the network is a ready state.

## Method: Create Subnetwork
Create a new subnetwork inside the specified VPC network, hosted in the specified region.

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project of the network. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. VPC Network (Autocomplete) **Required** - The network to create the subnetwork inside.
4. Subnetwork Name (String) **Required** - The name of the new subnetwork.
5. Description (Text) **Optional** - The description of the new subnetwork.
6. Region (Autocomplete) **Required** - The region to create the subnetwork inside.
7. IP Range (String) **Required** - The IP range in CIDR notation to reserve for the new subnetwork. For example 10.0.0.0/24.
8. Private Google API Access (Boolean) **Optional** - If specified, allow vm instances inside the subnetwork to access any google API.
9. Flow Logs (Boolean) **Optional** - If specified, enable flow logs for the new subnetwork.
10. Wait For Operation End (Boolean) **Optional** - If specified, wait for the new subnetwork to be in a ready state.

## Method: Reserve IP
Reserve the specified internal IP address inside the specified subnetwork, by creating a new address associated with the provided IP address.

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project of the network. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. VPC Network (Autocomplete) **Required for autocomplete in 'Subnetwork'** - The network of the subnetwork to reserve the IP address inside.
4. Subnetwork Region (Autocomplete) **Required for autocomplete in 'Subnetwork'** - The region of the subnetwork to reserve the IP address inside.
5. Subnetwork (Autocomplete) **Required** - The subnetwork to reserve an IP address inside. Must be in the range of IP addresses associated with the subnetwork.
6. Reserve name (String) **Required** - The name of the address resource created for the specified IP address.
7. IP To Reserve (String) **Required** - The IP address to reserve.
8. Wait For Operation End (Boolean) **Optional** - If specified, wait for the address to be available before returning.

## Method: Create Firewall
Create a new firewall rule for the specified VPC network.

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project of the VPC network. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. VPC Network (Autocomplete) **Required** - The VPC network to create the new firewall rule for.
4. Firewall Name (String) **Required** - The name of the new firewall rule.
5. Priority(0 - 65535) (String) **Optional** - The priority of the new firewall rule. Default value is 1000.
6. Direction (Options) **Optional** - The direction of the firewall rule. Possible values: 
* Ingress - for incoming network traffic
* Egress - for outgoing network traffic
Default value is ingress.
7. Action (Options) **Optional** - Whether to allow or deny access to ip addresses specified in the request. Possible values: Allow | Deny. Default value is Allow.
8. Ip Ranges Filter (Text) **Optional** - The IP ranges the new firewall rule will be applied to. If not specified, apply on any IP address.
9. Protocol (Options) **Required** - The protocol to allow or deny access to. Possible values: All | AH | ESP | ICMP | IPIP | SCTP | TCP | UDP.
10. Ports (Text) **Optional** - The ports to allow or deny access to in the specified protocol. **Only relevant for protocols that use ports**.
11. Wait For Operation End (Boolean) **Optional** - If specified, wait until the firewall rule was successfully created.

## Method: Create Route
Create a new route inside the specified network.

### Parameters
1. Service Account Credentials (Vault) **Required if not in settings** - The credentials to use for authenticating to the google cloud API.
2. Project (Autocomplete) **Required if not in settings** - The project of the network. **You need access to the "Cloud Resource Manager API" to use autocomplete in this parameter!**
3. VPC Network (Autocomplete) **Required** - The vpc network to create the new route in.
4. Route Name (String) **Required** - The name of the new route.
5. Next Hop IP (String) **Required** - The IP address to route any requests with the specified destination IP to.
6. Dest IP Range (String) **Required** - The range of IP addresses in CIDR notation, to route any traffic that is destined to an IP address in the specified range.
7. Priority (String) **Optional** - The priority of the new route.
8. Tags (Text) **Optional** - Tags to attach to the new route. Can enter multiple tags by specifying each with a new line.
9. Wait For Operation End (Boolean) **Optional** - If specified, wait until the new route was successfully created.
