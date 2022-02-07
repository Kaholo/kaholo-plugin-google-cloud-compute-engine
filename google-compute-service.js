const compute = require('@google-cloud/compute');
const { ProjectsClient } = require('@google-cloud/resource-manager');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const iam = google.iam('v1');
const { removeUndefinedAndEmpty } = require('./helpers');
const parsers = require("./parsers");


/** Class for using the google cloud compute API. */
module.exports = class GoogleComputeService {
    /**
     * Create a Google Cloud Compute service instance
     * @param {object} credentials The credentials of a service account to use to make the request 
     * @param {string} projectId The ID of the project to make all the requests about.
     */
    constructor(credentials, projectId) {
        // const computeOptions = { credentials };
        // if (projectId) computeOptions.projectId = projectId;
        // super(computeOptions);

        this.projectId = projectId;
        this.credentials = credentials;
    }

    /**
     * Get Google Compute Service Client from Kaholo action and settings objects
     * @param {object} params Kaholo Action Params Object
     * @param {string} settings Kaholo Settings Object
     * @return {GoogleComputeService} The Google Compute Service Client
     */
    static from(params, settings, noProject) {
        const creds = parsers.object(params.creds || settings.creds);
        if (!creds) throw "Must provide credentials to call any method in the plugin!";
        const project = noProject ? undefined : parsers.autocomplete(params.project || settings.project);
        return new GoogleComputeService(creds, project);
    }

    getAuthClient(){
        return new JWT(
            this.credentials.client_email, 
            null,
            this.credentials.private_key,
            ['https://www.googleapis.com/auth/cloud-platform']
        );
    }

    /**
    * Create and reserve external IP address for the specified instance. Reservation name will be `{instanceName}-ext-addr`
    * @param {string} region The region of the instance
    * @param {string} instanceName The name\id of the instance to create the external IP for 
    * @return {Promise<string>} The external address created for the instance
    */
    async createReservedExternalIP(region, instanceName) {
        const addrName = `${instanceName}-ext-addr`;

        let addressResource = {
            name: addrName,
            addressType: "EXTERNAL"
        };

        try {
            const addressesClient = new compute.AddressesClient({ credentials: this.credentials });
            let [operation] = await addressesClient.insert({ addressResource, project: this.projectId, region });

            // wait for the operation to end
            const operationsClient = new compute.RegionOperationsClient({ credentials: this.credentials });
            while (operation.status !== 'DONE') {
                [operation] = await operationsClient.wait({
                    operation: operation.name,
                    project: this.projectId,
                    region
                });
            }

            // get the result of operation
            let [response] = await addressesClient.get({ address: addrName, project: this.projectId, region })

            return response.address;
        }
        catch (err) {
            throw `Couldn't create external address with the name: ${addrName}\n${err.message || JSON.stringify(err)}`;
        }
    }

    /**
    * Delte reserved external IP address. Reserved IP name whic will be deleted is in this form `{instanceName}-ext-addr`
    * @param {string} region The region of the instance
    * @param {string} instanceName The name\id of the instance to create the external IP for 
    * @return {Promise<string>} The external address created for the instance
    */
    async deleteReservedExternalIP(region, instanceName) {
        // this address should be present in order for the method to work
        const addrName = `${instanceName}-ext-addr`;

        const request = removeUndefinedAndEmpty({
            project: this.projectId,
            region,
            address: addrName
        });

        try {
            const addressesClient = new compute.AddressesClient({ credentials: this.credentials });
            let [operation] = await addressesClient.delete(request);

            // wait for the operation to end
            const operationsClient = new compute.RegionOperationsClient({ credentials: this.credentials });
            while (operation.status !== 'DONE') {
                [operation] = await operationsClient.wait({
                    operation: operation.name,
                    project: this.projectId,
                    region
                });
            }

            return operation.status;

        } catch (err) {
            throw `Couldn't delete external address with the name: ${addrName}\n${err.message || JSON.stringify(err)}`
        }
    }

    /**
    * Create a new VM instance
    * @param {compute.protos.google.cloud.compute.v1.IInstance} instanceResource JSON representation of the instance which need to be created
    * @param {boolean} createReservedExtIP If true creates and reserves static external IP. If false External IP is not present at all (for this version);
    * @param {boolean} waitForOperation Whether to wait for the operation to finish before returning
    * @return {Promise} Information about the instance if succeded, Error in the other case.
    */
    async createInstance(instanceResource, createReservedExtIP, waitForOperation) {
        const instancesClient = new compute.InstancesClient({ credentials: this.credentials });

        // create reserved external IP and write it to networkInterfaces array which will be passed to instanceResource
        if (createReservedExtIP) {
            const natIP = await this.createReservedExternalIP(instanceResource.region, instanceResource.name);
            if (!instanceResource.networkInterfaces) {
                instanceResource.networkInterfaces = [{ accessConfigs: [{ natIP }] }];
            }
            else if (!instanceResource.networkInterfaces[0].accessConfigs) {
                instanceResource.networkInterfaces[0].accessConfigs = [{ natIP }];
            }
            else {
                instanceResource.networkInterfaces[0].accessConfigs[0].natIP = natIP;
            }
        }

        return new Promise(async (resolve, reject) => {
            try {
                // return Long-Running operation
                let [operation] = await instancesClient.insert({
                    instanceResource,
                    project: this.projectId,
                    zone: instanceResource.zone
                });

                if (waitForOperation) {
                    const operationsClient = new compute.ZoneOperationsClient({ credentials: this.credentials });

                    // Wait for the create operation to complete.
                    while (operation.status !== 'DONE') {
                        [operation] = await operationsClient.wait({
                            operation: operation.name,
                            project: this.projectId,
                            zone: instanceResource.zone,
                        });
                    }

                    // get instance after creation
                    let [response] = await instancesClient.get({
                        instance: instanceResource.name,
                        project: this.projectId,
                        zone: instanceResource.zone
                    });

                    resolve(response);
                }

                resolve(operation);
            } catch (error) {
                reject(error)
            }
        });
    }

    async listProjects(params) {
        const projectsClient = new ProjectsClient({ credentials: this.credentials })
        let query = params.query;

        const request = removeUndefinedAndEmpty({
            query: query ? `name:*${query}*` : undefined
        });

        let iterable = projectsClient.searchProjectsAsync(request);
        let res = []

        try {
            for await (let proj of iterable) {
                res.push(proj)
            }
        } catch (error) {
            throw error
        }

        return res;
    }

    async listRegions() {
        const regionsClient = new compute.RegionsClient({ credentials: this.credentials });

        const request = removeUndefinedAndEmpty({
            project: this.projectId,
        })

        let iterable = regionsClient.listAsync(request);
        let res = [];

        try {
            for await (let region of iterable) {
                res.push(region)
            }
        } catch (error) {
            throw error
        }

        return res;
    }

    async listZones(params) {
        const zonesClient = new compute.ZonesClient({ credentials: this.credentials });
        const region = parsers.autocomplete(params.region);

        const request = removeUndefinedAndEmpty({
            project: this.projectId,
            // filter: `name:${region}`
        })

        let iterable = zonesClient.listAsync(request);
        let res = [];

        try {
            for await (let zone of iterable) {
                res.push(zone)
            }
        } catch (error) {
            throw error
        }

        return res.filter(zone => !region || zone.name.includes(region));
        return res
    }

    async listMachineTypes(params) {
        const machineTypesClient = new compute.MachineTypesClient({ credentials: this.credentials });
        const zone = parsers.autocomplete(params.zone);

        const request = removeUndefinedAndEmpty({
            project: this.projectId,
            zone
        })

        let iterable = machineTypesClient.listAsync(request);
        let res = [
            { id: "custom-", name: "Custom N1(Default Custom)" },
            { id: "n2-custom-", name: "Custom N2" },
            { id: "n2d-custom-", name: "Custom N2D" },
            { id: "e2-custom-", name: "Custom E2" }
        ];

        try {
            for await (let machine of iterable) {
                res.push(machine)
            }
        } catch (error) {
            throw error
        }

        return res;
    }

    async listImageProjects(params){
        const userProjects = await this.listProjects(params);
        return [...userProjects, 
            {displayName: "Debian Cloud", projectId: "debian-cloud"}, 
            {displayName: "Windows Cloud", projectId: "windows-cloud"}, 
            {displayName: "Ubuntu Cloud", projectId: "ubuntu-os-cloud"}, 
            {displayName: "Ubuntu Pro Cloud", projectId: "ubuntu-os-pro-cloud"},
            {displayName: "Google UEFI(CentOS|COS) Images", projectId: "gce-uefi-images"},
            {displayName: "Machine Learning Images", projectId: "ml-images"},
            {displayName: "Fedora CoreOS Cloud", projectId: "fedora-coreos-cloud"},
            {displayName: "Windows SQL Cloud", projectId: "windows-sql-cloud"},
            {displayName: "Windows Cloud", projectId: "windows-cloud"},
            {displayName: "Red Hat Enterprise Linux SAP Cloud", projectId: "rhel-sap-cloud"},
            {displayName: "SUSE Cloud", projectId: "suse-cloud"},
            {displayName: "Rocky Linux Cloud", projectId: "rocky-linux-cloud"}
        ];
    }

    async listImages(params){
        const imagesClient = new compute.ImagesClient({ credentials: this.credentials });
        const imageProject = parsers.autocomplete(params.imageProject);

        const request = removeUndefinedAndEmpty({ 
            project: imageProject || this.projectId, 
        });

        let iterable = imagesClient.listAsync(request);
        let res = []

        try {
            for await (let image of iterable) {
                res.push(image)
            }
        } catch (error) {
            throw error
        }
        
        return res;
    }

    async listServiceAccounts(params){
        const project = parsers.autocomplete(params.project) || this.projectId;
        
        const request = removeUndefinedAndEmpty({ 
            auth: this.getAuthClient(),
            name: `projects/${project}`
        });
        
        return (await iam.projects.serviceAccounts.list(request)).data.accounts;
    }

    async listNetworks(params){
        const networksClient = new compute.NetworksClient({ credentials: this.credentials });
        const project = parsers.autocomplete(params.project) || this.projectId;

        const request = removeUndefinedAndEmpty({ 
            project: project, 
        });

        let iterable = networksClient.listAsync(request);
        let res = [];

        try {
            for await (let network of iterable) {
                res.push(network);
            }
        } catch (error) {
            throw error
        }

        return res;
    }

    async listSubnetworks(params){
        const subnetworksClient = new compute.SubnetworksClient({ credentials: this.credentials });
        const project = parsers.autocomplete(params.project) || this.projectId;
        const region = parsers.autocomplete(params.region);

        const request = removeUndefinedAndEmpty({ 
            project,
            region
        });

        let iterable = subnetworksClient.listAsync(request);
        let res = [];

        try {
            for await (let subnetwork of iterable) {
                res.push(subnetwork);
            }
        } catch (error) {
            throw error
        }

        return res;
    }
} 