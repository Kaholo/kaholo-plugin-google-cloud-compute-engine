# kaholo-plugin-GoogleCloudComputeEngine

This plugin integrate with GCP and provide several methods:

## Method: launch a vm

### Parameters
1. Credentials: (vault)
2. Project ID: 
3. Name
4. OS
5. Zone
6. Machine Type
7. Source image
8. Disk Type
9. Disk auto delete (boolean)
10. VPC name
11. Can IP forwart: (boolean)
12. Preemtible: (boolean)
13. Subnet path
14. Internal IP
15. Network interfaces
16. Tags
17. Labels object
18. Wait for operation end

## Method: stop a vm

### Parameters
1. Credentials: (vault)
2. name
3. zone
4. project id

## Method: start a vm

### Parameters
1. Credentials: (vault)
2. name
3. zone
4. project id

## Method: restart a vm

### Parameters
1. Credentials: (vault)
2. name
3. zone
4. project id

## Method: delete a vm

### Parameters
1. Credentials: (vault)
2. name
3. zone
4. project id

## Method: get external ip

### Parameters
1. Credentials: (vault)
2. name
3. zone
4. project id

## Method: create a vpc

### Parameters
1. Credential: (vault)
2. VPC name
3. project id
4. Wait for operationn end (boolean)

## Method: create subnetwork

### Parameters
1. Credentials: (vault)
2. VPC ID
3. subnet name
4. project id
5. region name
6. IP range
7. Wait for operation end (boolean)

## Method: Reserve IP

### Parameters
1. Credentials: (vault)
2. subnet name
3. project id
4. Reserve name
5. region name
6. IP to reserve

## Method: create firewall

### Parameters
1. Credentials: (vault)
2. project id
3. Firewall name
4. network name
5. Priority
6. Direction
7. Action
8. Source range
9. destination range
10. Protocol
11. Ports

## Method: create route

### Parameters
1. Credentials (vault)
2. Project ID
3. Name
4. VPC name
5. Next Hop IP
6. dest range
7. Priority
8. Tags
