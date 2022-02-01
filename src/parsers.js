function parseArray(value){
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof(value) === "string") return value.split("\n").map(line=>line.trim()).filter(line=>line);
    throw "Unsupprted array format";
}

module.exports = {
    boolean : (value) =>{
        if (!value || value === "false") return false;
        return true;
    },
    text : (value) =>{
        if (value)
            return value.split('\n');
        return undefined;
    },
    number: (value)=>{
        if (!value) return undefined;
        const parsed = parseInt(value);
        if (parsed === NaN) {
            throw `Value ${value} is not a valid number`
        }
        return parsed;
    },
    autocomplete: (value, getVal)=>{
        if (!value) return undefined;
        if (typeof(value) == "object") return (getVal ? value.value : value.id) || value;
        return value;
    },
    autocompleteOrArray: (value)=>{
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof(value) == "object") return [value.id || value];
        return [value];
    },
    object: (value)=>{
        if (!value) return undefined;
        if (typeof(value) === "object") return value;
        if (typeof(value) == "string") {
            try {
                return JSON.parse(value);
            }
            catch (e) {}
            const obj = {};
            value.split("\n").forEach(row => {
                let [key, ...val] = row.trim().split("=");
                if (!key || !val) throw "bad object format";
                if (Array.isArray(val)) val = val.join("=");
                obj[key] = val;
            });
            return obj;
        }
        throw `Value ${value} is not an object`;
    },
    string: (value)=>{
        if (!value) return undefined;
        if (typeof(value) === "string") return value.trim();
        throw `Value ${value} is not a valid string`;
    },
    googleCloudName: (value)=>{
        if (!value) return undefined;
        if (typeof(value) === "string") {
            // Google provided regexp: '(?:[a-z](?:[-a-z0-9]{0,61}[a-z0-9])?)'
            const regex = new RegExp("^[a-z]{1}[-a-z0-9]{0,61}[a-z0-9]{1}$");
            if (!regex.test(value)) {
                throw `Name must start with a lowercase letter followed by up to 62 lowercase letters, numbers, or hyphens, and cannot end with a hyphen. ${value} is invalid.`;
            }
            return value.trim();
        }
        throw `Value ${value} is not a valid string`;
    },
    array: parseArray
}