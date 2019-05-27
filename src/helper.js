function _stringArrayParamHandler(param, paramName){
    let paramValue = _handleParam(param);
    if (!Array.isArray(paramValue) && (typeof paramValue !== 'string'))
        throw new Error(`Invalid param: ${paramName}`);
    
    if(typeof paramValue == 'string')
        return [paramValue];
    
    return paramValue;
}

function _handleParam(param){
    if (typeof param != 'string'){
        return param;
    } else {
        try{
            return JSON.parse(param)
        }catch(err){
            return param
        }
    }
}

module.exports = {
    _handleParam, 
    _stringArrayParamHandler
};