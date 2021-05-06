# kaholo-plugin-GoogleCloudComputeEngine

Google Cloud Compute Engine (GCCE) plugin for Kaholo.

## Settings: 
1. Credentials (Vault) **Optional** - Default credentials for authenticating to the google cloud API. Needs to be saved in the format of a json object or a string representing it.

## Method: launch a vm
Starts a new VM instance in the google cloud. Does so according to this [documentation](https://cloud.google.com/compute/docs/instances/create-start-instance#api).

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. Needs to be saved in the format of a json object or a string representing it.
2. Project ID (String) **Required** - The ID of the project to launch the VM inside. 
3. Name (String) **Required** - The name of the VM instance to launch.
4. OS (String) **Optional** - The name of the OS to launch this VM on. If not specified it will be chosen by the API.
5. Zone (String) **Required** - The name of the zone to launch this vm instance from.
6. Machine Type(String/Object) **Optional** - Machine type, predefined or custom, for the new VM. Needs to be in the format of *zones/MACHINE_TYPE_ZONE/machineTypes/MACHINE_TYPE*.
7. Source image (String) **Optional** - The full name of the source image to make this VM from. Needs to be in the format of *projects/IMAGE_PROJECT/global/images/IMAGE* 
8. Disk Type (String) **Optional** - The type of the persistent disk to create for this VM. Will be chosen automatically by the API if not specified.
9. Disk auto delete (Boolean) **Optional** - Should automatically delete the disk of the VM when it's deleted. Default is false.
10. VPC name (String) **Optional** - Name of the network to connect the VM to. Enter in the following format *global/networks/NETWORK_NAME*
11. Can IP forward (Boolean) **Optional** - Whether to enable IP Forwarding or not.
12. Preemtible (Boolean) **Optional** - Whether to create the VM as preemtible instance or not. A preemptible VM is an instance that you can create and run at a much lower price than normal instances. However, Compute Engine might stop (preempt) these instances if it requires access to those resources for other tasks.
13. Subnet path (String) **Optional** - The subnet path in the internal network for the new VM.
14. Internal IP (String) **Optional** - The internal IP address of the new VM.
15. Network interfaces (Array) **Optional** - A custom array of network interfaces objects to apply to this VM instead of createing one automatically from parameters 10-14.
16. Tags (Array/String) **Optional** - An array of tags or a single tag string to apply to the new VM.
17. Labels (Object) **Optional** - Labels object to apply to the new VM. You can see more on the topic [here](https://cloud.google.com/compute/docs/labeling-resources).
18. Wait for operation end (Boolean) **Optional** - Whether to wait until the API finished creating the VM instance or not. Default value is false.
19. Auto Create Static IP Address (Boolean) **Optional** - Whether to automatically create and assign a static external IP address to this VM instance. Default value is false.

## Method: stop a vm
Stop a VM on the cloud.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. Needs to be saved in the format of a json object or a string representing it.
2. name (String) **Required** - The name of the VM instance to stop.
3. zone (String) **Required** - The zone of the VM.
4. project id (String) **Required** - The ID of the project of the VM.

## Method: start a vm
Start the specified VM instance(if he was stopped before).

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API.
2. name (String) **Required** - The name of the VM instance to start.
3. zone (String) **Required** - The zone of the VM.
4. project id (String) **Required** - The ID of the project of the VM.

## Method: restart a vm
Restart the specified VM.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. name (String) **Required** - The name of the VM instance to restart.
3. zone (String) **Required** - The zone of the VM.
4. project id (String) **Required** - The ID of the project of the VM.

## Method: delete a vm
Delete the specified VM.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. name (String) **Required** - The name of the VM instance to delete.
3. zone (String) **Required** - The zone of the VM.
4. project id (String) **Required** - The ID of the project of the VM.

## Method: get external ip
Get the external IP address of the specified VM.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. name (String) **Required** - The name of the VM to get it's address.
3. zone (String) **Required** - The zone of the VM.
4. project id (String) **Required** - The ID of the project of the VM.

## Method: create a vpc
Create a new VPC resource in the cloud

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. VPC name (String) **Required** - The name of the new VPC.
3. project id (String) **Required** - The ID of the project to create this VPC in.
4. Wait for operationn end (Boolean) **Optional** - Whether to wait until the API finished creating the VPC resource or not. Default value is false.

## Method: create subnetwork
Create a new subnetwork inside the specified VPC.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. VPC ID (String) **Required** - The ID of the VPC to create the subnetwork in.
3. subnet name (String) **Required** - The name of the subnetwork to create.
4. project id (String) **Required** - The ID of the project of the specified VPC. 
5. region name (String) **Required** - The region to create this subnetwork in.
6. IP range (String) **Required** - The range of IP address to assign to this subnetwork. 
7. Wait for operation end (Boolean) **Optional** - Whether to wait until the API finished creating the subnetwork or not. Default value is false.

## Method: Reserve IP
Reserve an internal IP address and create a resource for it, from the specified subnetwork.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. subnet name (String) **Required** - The name of the sunetwork to rese=rve this IP address from.
3. project id (String) **Required** - The name of the project of the subnetwork.
4. Reserve name (String) **Required** -The name to give to the new internal IP address resource.
5. region name (String) **Required** - The region of the subnetwork.
6. IP to reserve (String) **Required** - The IP address to reserve from the subnetwork.

## Method: create firewall
Create a new firewall instance in the cloud.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. project id (String) **Required** -The name of the project to create the new firewall inside.
3. Firewall name (String) **Required** - The name of the new firewall.
4. network name (String) **Required** -The name of the network that the firewall will sit on. Must be in the same project as the firewall.
5. Priority (Int: 0 to 65535) **Optional** - The priority of the new firwall. The relative priority of a firewall rule determines whether it is applicable when evaluated against others. The lower the value the higher the priority. Default is 1000.
6. Direction (Ingress/Egress) **Optional** - Ingress is for inbound traffic, and Egress is for outbound traffic. Default value is Ingress.
7. Action (Allow/Deny) **Optional** - What to do when the firewall rule finds a match. Default value is allow.
8. Source range (String/Array) **Optional** - The source ip addresses this firewall rule will apply on. If not specified will apply on messages with any source ip address. 
9. destination range **Optional** - The destination ip addresses this firewall rule will apply on. If not specified will apply on messages with any destination ip address. 
10. Protocol **Optional** - The ip protocol this rule will apply on. can be: tcp, udp, icmp, esp, ah, sctp, ipip or all).
11. Ports **Optional** - The ports on which the firewall rule will apply on. if not specified will apply on all ports.

## Method: create route
Create a route resource to direct traffic from a range of IP address to a different IP address.

### Parameters
1. Credentials (Vault) **Optional** - Credentials for authenticating to the google cloud API. 
2. Project ID (String) **Required** - The name of the project to create the new route inside.
3. Name (String) **Required** - The name the new route resource.
4. VPC name (String) **Required** - The name of the network(VPC) the route will sit on.
5. Next Hop IP (String) **Required** - The IP address to forward to.
6. dest range (String) **Required** - The range of the destination IP addresses to route the new Next Hop IP.
7. Priority (Int: 0 to 65535) **Optional** - The priority of the new route. The relative priority of a route determines whether it is applicable when evaluated against others. The lower the value the higher the priority. Default is 1000.
8. Tags (Array/String) **Optional** - An array of tags or a single tag string to apply to the new route.
