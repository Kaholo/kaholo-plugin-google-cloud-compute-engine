const compute = require('@google-cloud/compute');


function launchInstance(action) {
    return new Promise((resolve, reject) => {
        const gce = authenticate(action.params.PROJECT, action.params.CREDENTIALS);

        const zone = gce.zone(action.params.ZONE);

        const config = {
            os: action.params.OS,
            http: !!action.params.HTTP,
            https: !!action.params.HTTPS
        };

        if (action.params.MACHINE_TYPE) {
            config.machineType = action.params.MACHINE_TYPE;
        }

        zone.createVM(action.params.NAME, config, (err, vm, operation) => {
            // `operation` lets you check the status of long-running tasks.

            operation
                .on('error', function (err) {
                    reject(err);
                })
                .on('running', function (metadata) {
                    console.log(metadata);
                })
                .on('complete', function (metadata) {
                    console.log("Virtual machine created!");
                    resolve(metadata);
                });
        });
    });

}

function authenticate(projectId, credentials) {
    try {
        credentials = JSON.parse(credentials)
    } catch (e) {
        throw new Error("Bad credentials");
    }
    return compute({
        projectId,
        credentials
    });
}

function deleteUpdateRestartInstance(action) {
    return new Promise((resolve, reject) => {
        const gce = authenticate(action.params.PROJECT, action.params.CREDENTIALS);

        let zone = gce.zone(action.params.ZONE);
        let name = action.params.NAME;
        const vm = zone.vm(name);


        switch (action.method.name) {
            case 'STOP_INSTANCE':
                return vm.stop();
            case 'DELETE_INSTANCE':
                return vm.delete();
            case 'RESET_INSTANCE':
                return vm.reset();
            default:
                throw new Error("Unknown method");
        }

    }).then(data => new Promise((resolve, reject) => {
        console.log(data[0]);
        resolve(data[1]);
    }));
}


const functions = {
    LAUNCH_INSTANCE: launchInstance,
    STOP_INSTANCE: deleteUpdateRestartInstance,
    DELETE_INSTANCE: deleteUpdateRestartInstance
    RESTART_INSTANCE: deleteUpdateRestartInstance
};

function main(argv) {
    if (argv.length < 3) {
        console.log('{err: "not enough parameters"}');
        // Invalid Argument
        // Either an unknown option was specified, or an option requiring a value was provided without a value.
        process.exit(9);
    }
    const action = JSON.parse(argv[2]);
    functions[action.method.name](action).then((res) => {
        console.log(res);
        process.exit(0); // Success
    }).catch((err) => {
        console.log("an error occured", err);
        // Uncaught Fatal Exception
        // There was an uncaught exception, and it was not handled by a domain or an 'uncaughtException' event handler.
        process.exit(1); // Failure
    });
}

main(process.argv);