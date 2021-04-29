function _stringArrayParamHandler(param, paramName){
    if(typeof param == 'string')
        return [param];
    
    return param;
}

module.exports = {
    _stringArrayParamHandler
};