import '@material/mwc-button';
import '@material/mwc-icon-button';
import '@material/mwc-textfield';
import '@material/mwc-switch';
import '@material/mwc-snackbar';

// server config
const HOSTNAME = "localhost";
const PORT = "8080";
const URL = `http://${HOSTNAME}:${PORT}`;

// errors
const ErrorCode = Object.freeze({
    UPDATE_FAILED: "Updating the traffic lights configuration failed.",
    ON_OFF_FAILED: "Turning the traffic lights on or off failed.",
    NO_CONNECTION_ERROR: "Cannot connect to the traffic lights controller.",
    LIGHT_CONTROLLER_DOWN_ERROR: "The traffic light controller does not react.",
    UNEXPECTEND_ERROR_WHILE_START_OR_STOP: "An unexpected error occurred while starting or stopping the traffic lights controller.",
    UNEXPECTED_ERROR_WHILE_UPDATING: "An unexpected error occurred while updating the traffic lights configuration."
});

// hint
const NO_CURRENT_CONFIG = "There is no configuration which can be loaded. Please enter your own one.";

let currentStateOnline;
let syncInterval;
let checkOtherInterval;

// elements
const onSilder = document.querySelector('#onSlider');

const greenDurationField = document.querySelector('#greenDuration');
const yellowDurationField = document.querySelector('#yellowDuration');
const yellowRedDurationField = document.querySelector('#yellowRedDuration');
const minRedDurationField = document.querySelector('#redLower');
const maxRedDurationField = document.querySelector('#redUpper');

const fields = [... document.querySelectorAll('.field')];
const fixeds = [... document.querySelectorAll('.fixed')];
const intervals = [... document.querySelectorAll('.interval')];

const eventToast = document.querySelector('#event-toast');
const stateFooter = document.querySelector('#stateFooter');

const updateButton = document.querySelector('#update');
const syncButton = document.querySelector('#sync');

// check if controller is alive
const isAlive = () => new Promise(resolve => fetch(`${URL}/heartbeat`).then(res => resolve(res.ok)).catch(err => resolve(false)));

// state handling
const changeState = isOnline => {
    if(currentStateOnline == isOnline) {
        return;
    }

    if(isOnline == true) {
        stateFooter.innerHTML = 'online';
        stateFooter.classList = ['online'];
        stateFooter.style.visibility = 'visible';
        currentStateOnline = true;
        new Promise(resolve => {
            setTimeout(resolve, 7000);
        }).then(() => stateFooter.style.visibility = 'hidden');
    } else {
        stateFooter.innerHTML = "offline";
        stateFooter.classList = ['offline'];
        stateFooter.style.visibility = 'visible';

        currentStateOnline = false;
        syncInterval = setInterval(() => {
            isAlive().then(res => {
                console.log(`Sync result: ${res}`);
                if (res) {
                    clearInterval(syncInterval);
                    changeState(true);
                }
            })
        }, 5000);
    }
};

// fetches config data
const fetchCurrentData = (onSuccessCallback = () => {}) => fetch(`${URL}/config`).then(res => {
    console.log(res);
    if (res.status == 404) {
        throw NO_CURRENT_CONFIG;
    }
    res.json().then(data => {
        greenDurationField.value = data.greenLightDuration;
        yellowDurationField.value = data.yellowLightDuration;
        yellowRedDurationField.value = data.yellowRedLightDuration;
        minRedDurationField.value = data.lowerIntervalBorder;
        maxRedDurationField.value = data.upperIntervalBorder;
        reportSuccess("Loaded current traffic lights configuration.");
        onSuccessCallback();
    });
}).catch(err => err == NO_CURRENT_CONFIG ? reportMessage(err): reportError(err));

const fetchCurrentControllerState = () => fetch(`${URL}/running`).then(res => {
    if(res.status === 200) {
        onSilder.checked = true;
    } else if (res.status === 204) {
        onSilder.checked = false;
    } else if (res && !res.ok) {
        throw ErrorCode.LIGHT_CONTROLLER_DOWN_ERROR;
    } else {
        throw ErrorCode.UNEXPECTED_ERROR_WHILE_UPDATING;
    }
}).catch(err => handleError(err));

// determines initial state
const sync = () => isAlive().then(result => {
    changeState(result);
    if (!result) {
        throw ErrorCode.NO_CONNECTION_ERROR
    }
    fetchCurrentData(fetchCurrentControllerState);
}).catch(err => handleError(err));

sync();

// validity
const biggerThanZeroConstraint = (newValue, nativeValidity) => {
    if (!nativeValidity.valid) {
        return {};
    }

    const isValid = (newValue > 0 || newValue == "")
    console.log(`Is valid: ${isValid}`)
    return {
        valid: isValid,
        customError: !isValid
    };
};

// check if the interval is valid
const validInterval = (newValue, nativeValidity, currentElement) => {
    if (!nativeValidity.valid) {
        return {};
    }

    const isValid = (newValue > 0 || newValue == "")  && parseInt(minRedDurationField.value) < parseInt(maxRedDurationField.value);
    if (checkOtherInterval) {
        console.log("trigger check");
        const otherElement = currentElement == minRedDurationField ? maxRedDurationField : minRedDurationField;
        checkOtherInterval = false;
        otherElement.reportValidity();
    } else {
        checkOtherInterval = true;
    }

    console.log(`Is valid: ${isValid}`);

    return {
        valid: isValid,
        customError: !isValid
    };
};

// add bigger than zero constraint to the green, yellow and red-yellow textfield
fixeds.forEach(element => {
    element.validityTransform = biggerThanZeroConstraint 
});

minRedDurationField.addEventListener('change', () => maxRedDurationField.checkValidity());
maxRedDurationField.addEventListener('change', () => minRedDurationField.checkValidity());

intervals.forEach(element => {
    element.validityTransform = (newValue, nativeValidity) => validInterval(newValue, nativeValidity, element);
});

const reportMessage = message => {
    eventToast.labelText = message;
    eventToast.show();
}

// reporting error messages
const reportError = message => {
    reportMessage(message)
    if (ErrorCode.NO_CONNECTION_ERROR) {
        changeState(false);
    }
};


const handleError = (error, defaultErrorCase) => 
    Object.values(ErrorCode).includes(error) ? reportError(error): reportError(defaultErrorCase);


// report validation errors
const reportInvalidFields = () => {
    const invalidFieldMessages = fields.filter(field => !field.valid).map(field => `${field.label}: "${field.value}"\n`);
    let validationReport = 'The following fields are invalid: ';
    invalidFieldMessages.forEach(message => {
        if (message != invalidFieldMessages[0]) {
            validationReport += ', ';
            }
        validationReport += message;
    });
    eventToast.labelText = validationReport;
    eventToast.show();
};

// reporting successes messages
const reportSuccess = message => {
    reportMessage(message)
    changeState(true);
};

// current textfield values to json 
const inputDataToJSON = () => {
    return {
        lowerIntervalBorder: parseInt(minRedDurationField.value),
        upperIntervalBorder: parseInt(maxRedDurationField.value),
        greenLightDuration: parseInt(greenDurationField.value),
        yellowLightDuration: parseInt(yellowDurationField.value),
        yellowRedLightDuration: parseInt(yellowRedDurationField.value)
    }
};

// updating server config
const updateServerData = () => {
    const allValid = fields.reduce((x,y) => x && y.checkValidity(), fields, true);
    if (!allValid) {
        reportInvalidFields();
        console.log("Some fields seem to be invalid.");
        return;
    }

    const handlePromise = (prom, operation) => {
        prom.then(res => {
            if(res && !res.ok && res.status === 500) {
                throw ErrorCode.ON_OFF_FAILED;
            } else if(res && !res.ok) {
                throw ErrorCode.UNEXPECTEND_ERROR_WHILE_START_OR_STOP;
            } else if(!res) {
                throw ErrorCode.NO_CONNECTION_ERROR;
            }
            if (res.status == 204) {
                reportSuccess('Successfully updated the traffic lights configuration.');
                return;
            }
            reportSuccess(`Successfully updated the configuration and ${operation} the traffic lights.`);
        }).catch(err => handleError(err))
    }

    const data = inputDataToJSON();
    fetch(`${URL}/config`, {
        method: 'POST',
        body: JSON.stringify(data)
    }).catch(err => handleError(err)).then(res => {
        if (res && !res.ok) {
            throw ErrorCode.UPDATE_FAILED;
        } else if(!res) {
            throw ErrorCode.NO_CONNECTION_ERROR;
        }

        onSilder.checked ?
            handlePromise(fetch(`${URL}/start`), 'started'):
            handlePromise(fetch(`${URL}/stop`), 'stopped');
    }).catch(err => handleError(err, ErrorCode.UNEXPECTED_ERROR_WHILE_UPDATING));
};

updateButton.addEventListener('click', () => updateServerData());
syncButton.addEventListener('click', () => sync());