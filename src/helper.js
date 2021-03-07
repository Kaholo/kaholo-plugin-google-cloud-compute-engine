function _stringArrayParamHandler(param, paramName){
    let paramValue = _handleParam(param);
    if (!Array.isArray(paramValue) && (typeof paramValue !== 'string'))
        throw new Error(`Invalid param: ${paramName}`);
    
    if(typeof paramValue == 'string')
        return [paramValue];
    
    return paramValue;
}

module.exports = {
    _stringArrayParamHandler
};