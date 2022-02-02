function removeUndefinedAndEmpty(obj){
    Object.entries(obj).forEach(([key, value]) => {
        if (key === "auth") return;
        if (value === undefined) delete obj[key];
        if (Array.isArray(value) && value.length === 0) delete obj[key];
        if (typeof(value) === 'object'){
            removeUndefinedAndEmpty(value);
            if (Object.keys(value).length === 0) delete obj[key];
        };
    });
    return obj;
}

/**
 * Return the default callback function for google cloud compute functions
 * @param {function} resolve The function to call in the case of success. 
 * @param {function} reject The function to call in the case of a failure. 
 * @param {boolean} waitForOperation Whether to wait for the end of the operation provided to the callback. 
 * @return {function} The callback function made from the specified parameters 
 */
function defaultGcpCallback(resolve, reject, waitForOperation){
    if (!waitForOperation) return (err, entity, operation, apiResponse) => {
        if (err) return reject(err);
        return resolve(apiResponse);
    }
    return (err, entity, operation, apiResponse) => {
        if (err) return reject(err);
        return handleOperation(operation).then(data=> resolve(data)).catch(reject);
    }
}


/**
 * Return a promise that responds to events from the specified operation
 * @param {Compute.Operation} operation The operation to make the promise for. 
 * @return {Promise<object>} The metadata got back from the operation.
 */
async function handleOperation(operation){
    return new Promise((resolve,reject)=>{
        try {
            operation
                .on('error', function (err) {
                    reject(err);
                })
                .on('running', function (metadata) {
                    console.log(metadata);
                })
                .on('complete', function (metadata) {
                    resolve(metadata);
                });
        } catch (e) {
            reject(e);
        }
    });
}

function parseFields(fields, prefix="items"){
    if (!fields) return undefined;
    return fields.sort().map(field => `${prefix}/${field}`).join(", ");
}

module.exports = {
    removeUndefinedAndEmpty,
    defaultGcpCallback,
    handleOperation,
    parseFields,
}