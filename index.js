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
const UPDATE_FAILED = "Updating the traffic lights configuration failed.";
const ON_OFF_FAILED = "Turning the traffic lights on or off failed.";
const NO_CONNECTION_ERROR = "Cannot connect to the traffic lights controller.";
const LIGHT_CONTROLLER_DOWN_ERROR = "The traffic light controller does not react.";
const UNEXPECTEND_ERROR_WHILE_START_OR_STOP = "An unexpected error occurred while starting or stopping the traffic lights controller.";
const UNEXPECTED_ERROR_WHILE_UPDATING = "An unexpected error occurred while updating the traffic lights configuration.";
const NO_CURRENT_CONFIG = "There is no configuration.";

var currentStateOnline;
var syncInterval;

// elements
const onSilder = document.querySelector('#onSlider');

const greenDurationField = document.querySelector('#greenDuration');
const yellowDurationField = document.querySelector('#yellowDuration');
const yellowRedDurationField = document.querySelector('#yellowRedDuration');
const minRedDurationField = document.querySelector('#redLower');
const maxRedDurationField = document.querySelector('#redUpper');

const fields = document.querySelectorAll('.field');
const fixeds = document.querySelectorAll('.fixed');
const intervals = document.querySelectorAll('.interval');

const eventToast = document.querySelector('#event-toast');
const stateFooter = document.querySelector('#stateFooter');

const updateButton = document.querySelector('#update');
const syncButton = document.querySelector('#sync');

// check if controller is alive
const isAlive = () => new Promise(resolve => fetch(`${URL}/heartbeat`).then(res => {
        resolve(res.ok);
    }).catch(err => {
        resolve(false);
    }));


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
        return;
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
});

const fetchCurrentControllerState = () => fetch(`${URL}/running`).then(res => {
    if(res.status === 200) {
        onSilder.checked = true;
    } else if (res.status === 204) {
        onSilder.checked = false;
    } else if (res && !res.ok) {
        throw LIGHT_CONTROLLER_DOWN_ERROR;
    } else {
        throw UNEXPECTED_ERROR_WHILE_UPDATING;
    }
    }).catch(err => {
    switch (err) {
        case LIGHT_CONTROLLER_DOWN_ERROR:
        reportError(err);
        break;

        case UNEXPECTED_ERROR_WHILE_UPDATING:
        reportError(err);
        break;

        default:
        reportError(NO_CONNECTION_ERROR);
        break;
    }
});

// determines initial state
const sync = () => isAlive().then(result => {
    changeState(result);
    fetchCurrentData(fetchCurrentControllerState);
});

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

// reporting error messages
const reportError = error => {
    eventToast.labelText = error;
    eventToast.show();
    if (NO_CONNECTION_ERROR) {
    changeState(false);
    }
};

// report validation errors
const reportInvalidFields = () => {
    const invalidFieldMessages = [... fields].filter(field => !field.valid).map(field => `${field.label}: "${field.value}"\n`);
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
    eventToast.labelText = message;
    eventToast.show();
    changeState(true);
};

// current textfield values to json 
const inputDataToJSON = () => {
    return {
        lowerIntervalBorder: minRedDurationField.value,
        upperIntervalBorder: maxRedDurationField.value,
        greenLightDuration: greenDurationField.value,
        yellowLightDuration: yellowDurationField.value,
        yellowRedLightDuration: yellowRedDurationField.value
    }
};

// updating server config
const updateServerData = () => {

    const allValid = [... fields].reduce((x,y) => x && y.checkValidity(), fields, true);
    if (!allValid) {
        reportInvalidFields();
        console.log("Some fields seem to be invalid.");
        return;
    }

    const handleStartStopFetchPromise = (prom, operation) => {
        prom.then(res => {
            if(res && !res.ok && res.status === 500) {
            throw ON_OFF_FAILED;
            } else if(res && !res.ok) {
            throw UNEXPECTEND_ERROR_WHILE_START_OR_STOP;
            } else if(!res) {
            throw NO_CONNECTION_ERROR;
            }
            if (res.status == 204) {
                reportSuccess('Successfully updated the traffic lights configuration.');
                return;
            }
            reportSuccess(`Successfully updated the configuration and ${operation} the traffic lights.`);
        }).catch(err => {
            switch (err) {
                case ON_OFF_FAILED:
                reportError(ON_OFF_FAILED);
                break;

                case UNEXPECTEND_ERROR_WHILE_START_OR_STOP:
                reportError(UNEXPECTEND_ERROR_WHILE_START_OR_STOP);
                break;
            
                default:
                reportError(NO_CONNECTION_ERROR);
                break;
            }
        })
    }

    const data = inputDataToJSON();
    fetch(`${URL}/config`, {
        method: 'POST',
        body: JSON.stringify(data)
    }).catch(err => reportError(NO_CONNECTION_ERROR)).then(res => {
        if (res && !res.ok) {
            throw UPDATE_FAILED;
        } else if(!res) {
            throw NO_CONNECTION_ERROR;
        }

        if (onSilder.checked) {
            const startPromise = fetch(`${URL}/start`);
            handleStartStopFetchPromise(startPromise, 'started');
        } else { 
            const startPromise = fetch(`${URL}/stop`);
            handleStartStopFetchPromise(startPromise, 'stopped');
        }
    }).catch(err => { 
        switch (err) {
            case UPDATE_FAILED:
                reportError(err);
                break;

            case NO_CONNECTION_ERROR:
                reportError(err);
                break;
        
            default:
                reportError(UNEXPECTED_ERROR_WHILE_UPDATING);
                break;
        }
    });
};

updateButton.addEventListener('click', () => updateServerData());
syncButton.addEventListener('click', () => sync());