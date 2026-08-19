// Elemente & Konstanten
let rxCharacteristic = null;
let txCharacteristic = null;
let bluetoothDevice = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const statusBox = document.getElementById("status");

const lifterSlider = document.getElementById("lifterSlider");
const lifterValue = document.getElementById("lifterValue");

// Groesster erlaubter Anzeige-/Servo-Wert
const LIFTER_MAX = 110;

// Schrittweite fuer die Pfeile in Grad
const LIFTER_STEP = 10;

// Letzter bekannter Anzeige-Wert der Website
let currentLifterDisplayValue = Number(localStorage.getItem("lastLifterDisplayValue")) || 0;

// Empfangspuffer fuer Bluetooth-Nachrichten
let receiveBuffer = "";

// Fahrbuttons: welcher Button sendet welchen Befehl
const driveMap = {
    upBtn:    { press: "UP",    release: "up"    },
    downBtn:  { press: "DOWN",  release: "down"  },
    leftBtn:  { press: "LEFT",  release: "left"  },
    rightBtn: { press: "RIGHT", release: "right" }
};


// Bluetooth: verbinden & senden

async function connectBluetooth() {

    try {
        const serviceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

        const rxUuid = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Webseite sendet an Calliope
        const txUuid = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Calliope sendet an Webseite

        statusBox.textContent = "Verbinde...";

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{
                namePrefix: "Calliope"
            }],
            optionalServices: [serviceUuid]
        });

        bluetoothDevice.addEventListener("gattserverdisconnected", handleDisconnect);

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService(serviceUuid);

        rxCharacteristic = await service.getCharacteristic(rxUuid);
        txCharacteristic = await service.getCharacteristic(txUuid);

        await txCharacteristic.startNotifications();

        txCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleReceivedData
        );

        statusBox.textContent = "Verbunden";

        // Website zeigt erstmal den letzten bekannten Wert an
        setLifterDisplay(currentLifterDisplayValue);

        // Danach Calliope aktiv nach seinem aktuellen Wert fragen
        await send("GETLIFTER");

    } catch (error) {
        console.error(error);
        statusBox.textContent = "Verbindung fehlgeschlagen";
    }
}

function handleDisconnect() {
    statusBox.textContent = "Getrennt";

    rxCharacteristic = null;
    txCharacteristic = null;
}


// Befehl senden
async function send(command) {

    if (!rxCharacteristic) {
        console.warn("Nicht verbunden. Befehl nicht gesendet:", command);
        return;
    }

    try {
        const data = encoder.encode(command + "\n");
        await rxCharacteristic.writeValueWithoutResponse(data);

    } catch (error) {
        console.error(error);
        statusBox.textContent = "Senden fehlgeschlagen";
    }
}


// Daten vom Calliope empfangen
function handleReceivedData(event) {

    const receivedText = decoder.decode(event.target.value);

    receiveBuffer += receivedText;

    const messages = receiveBuffer.split("\n");

    // Letzten Teil behalten, falls die Nachricht unvollstaendig angekommen ist
    receiveBuffer = messages.pop();

    for (const rawMessage of messages) {

        const message = rawMessage.trim();

        if (message === "") {
            continue;
        }

        console.log("Vom Calliope empfangen:", message);

        handleCalliopeMessage(message);
    }
}


// Einzelne Calliope-Nachricht auswerten
function handleCalliopeMessage(message) {

    if (message.startsWith("LIFTER:")) {

        const valueText = message.replace("LIFTER:", "").trim();
        const servoValue = Number(valueText);

        if (Number.isNaN(servoValue)) {
            console.warn("Ungueltiger Lifter-Wert empfangen:", message);
            return;
        }

        // Wichtig:
        // Die Website sendet an den Servo gespiegelt:
        // displayValue -> servoValue = LIFTER_MAX - displayValue
        //
        // Deshalb muss beim Empfangen zur Anzeige zurueckgerechnet werden:
        // servoValue -> displayValue = LIFTER_MAX - servoValue

        const displayValue = LIFTER_MAX - servoValue;

        setLifterDisplay(displayValue);

        console.log("Lifter aktualisiert. Servo:", servoValue, "Anzeige:", displayValue);
    }
}


document
    .getElementById("connectBtn")
    .addEventListener("click", connectBluetooth);


// Fahren starten
function driveStart(id) {
    document.getElementById(id).classList.add("active");
    send(driveMap[id].press);
}


// Fahren stoppen
function driveStop(id) {
    document.getElementById(id).classList.remove("active");
    send(driveMap[id].release);
}


// Maus/Touch an einen Fahrbutton binden
function bindDriveButton(id) {

    const button = document.getElementById(id);

    button.addEventListener("pointerdown", () => driveStart(id));
    button.addEventListener("pointerup", () => driveStop(id));
    button.addEventListener("pointerleave", () => driveStop(id));
    button.addEventListener("pointercancel", () => driveStop(id));
}


for (const id of Object.keys(driveMap)) {
    bindDriveButton(id);
}


// Selbstfahren

let selfDriveOn = false;

const selfDriveBtn = document.getElementById("selfDriveBtn");

selfDriveBtn.addEventListener("click", () => {

    selfDriveOn = !selfDriveOn;

    if (selfDriveOn) {
        send("SELFDRIVEON");
        selfDriveBtn.textContent = "Selbstfahren: AN";
        selfDriveBtn.classList.add("on");
    } else {
        send("SELFDRIVEOFF");
        selfDriveBtn.textContent = "Selbstfahren: AUS";
        selfDriveBtn.classList.remove("on");
    }
});


// Kurzes optisches Feedback fuer einen Button geben
function flashButton(id) {
    const button = document.getElementById(id);
    button.classList.add("active");
    setTimeout(() => button.classList.remove("active"), 120);
}


document
    .getElementById("turtleBtn")
    .addEventListener("click", () => {
        send("SCHILDKROETE");
        flashButton("turtleBtn");
    });


document
    .getElementById("rabbitBtn")
    .addEventListener("click", () => {
        send("HASE");
        flashButton("rabbitBtn");
    });


// Heber

// Zahl auf 3 Stellen mit fuehrenden Nullen bringen, z. B. 90 -> "090"
function pad3(value) {
    return String(value).padStart(3, "0");
}


// Wert begrenzen
function clampLifterValue(value) {
    return Math.max(0, Math.min(LIFTER_MAX, Math.round(value)));
}


// Nur Website-Anzeige aktualisieren, nichts senden
function setLifterDisplay(displayValue) {

    displayValue = clampLifterValue(displayValue);

    currentLifterDisplayValue = displayValue;

    localStorage.setItem("lastLifterDisplayValue", String(displayValue));

    lifterSlider.value = displayValue;
    lifterValue.textContent = displayValue + "°";
}


// Heber setzen, anzeigen und an Calliope senden
function updateLifter(displayValue) {

    displayValue = clampLifterValue(displayValue);

    setLifterDisplay(displayValue);

    // Anzeige-Wert in echten Servo-Wert umrechnen
    const servoValue = LIFTER_MAX - displayValue;

    send("c" + pad3(servoValue));
}


// Heber um einen Schritt bewegen
function moveLifter(step) {
    updateLifter(Number(lifterSlider.value) + step);
}


// Slider sendet live den Wert
lifterSlider.addEventListener("input", () => {
    updateLifter(Number(lifterSlider.value));
});


// Pfeil hoch -> Heber hoch
document
    .getElementById("lifterUpBtn")
    .addEventListener("click", () => moveLifter(LIFTER_STEP));


// Pfeil runter -> Heber runter
document
    .getElementById("lifterDownBtn")
    .addEventListener("click", () => moveLifter(-LIFTER_STEP));


// Startwert auf der Website setzen
setLifterDisplay(currentLifterDisplayValue);
