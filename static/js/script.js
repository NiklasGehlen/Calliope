// Elemente & Konstanten
let rxCharacteristic = null;
let txCharacteristic = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const statusBox = document.getElementById("status");

const lifterSlider = document.getElementById("lifterSlider");
const lifterValue = document.getElementById("lifterValue");

// Groesster erlaubter Anzeige-/Servo-Wert
const LIFTER_MAX = 110;

// Schrittweite fuer die Pfeile (in Grad)
const LIFTER_STEP = 10;
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

        const device = await navigator.bluetooth.requestDevice({
            filters: [{
                namePrefix: "Calliope"
            }],
            optionalServices: [serviceUuid]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(serviceUuid);

        rxCharacteristic = await service.getCharacteristic(rxUuid);
        txCharacteristic = await service.getCharacteristic(txUuid);

        await txCharacteristic.startNotifications();

        txCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleReceivedData
        );

        statusBox.textContent = "Verbunden";

        await send("GETLIFTER");

    } catch (error) {
        console.error(error);
        statusBox.textContent = "Verbindung fehlgeschlagen";
    }
}

// Befehl senden
async function send(command) {

    if (!rxCharacteristic) {
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

function handleReceivedData(event) {

    const text = decoder.decode(event.target.value).trim();

    console.log("Vom Calliope empfangen:", text);

    const messages = text.split("\n");

    for (const message of messages) {

        if (message.startsWith("LIFTER:")) {

            const angleText = message.replace("LIFTER:", "");
            const angle = Number(angleText);

            if (!Number.isNaN(angle)) {
                setLifterDisplay(angle);
            }
        }
    }
}

document
    .getElementById("connectBtn")
    .addEventListener("click", connectBluetooth);



// Fahren starten (Button optisch aktiv, "press" senden)
// das active tag ist einfach dafür da das während der knopf gedürckt wird der button kleiner bleibt
// er holt sich aus der drive map den passenden befehl
function driveStart(id) {
    document.getElementById(id).classList.add("active");
    send(driveMap[id].press);
}

// Fahren stoppen (Button optisch normal, "release" senden)
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
}

for (const id of Object.keys(driveMap)) {
    bindDriveButton(id);
}

// Selbstfahren (Umschalter)

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


// Heber (Slider & Pfeile)

// Zahl auf 3 Stellen mit fuehrenden Nullen bringen (z. B. 90 -> "090")
function pad3(value) {
    return String(value).padStart(3, "0");
}

function setLifterDisplay(displayValue) {

    displayValue = Math.max(0, Math.min(LIFTER_MAX, Math.round(displayValue)));

    lifterSlider.value = displayValue;
    lifterValue.textContent = displayValue + "\u00B0";
}

// Heber setzen, anzeigen und senden.
// displayValue = das, was der Nutzer sieht (0..LIFTER_MAX).
// Der echte Servo-Winkel ist gedreht: servo = LIFTER_MAX - displayValue.
function updateLifter(displayValue) {

    displayValue = Math.max(0, Math.min(LIFTER_MAX, Math.round(displayValue)));

    setLifterDisplay(displayValue);

    const servo = LIFTER_MAX - displayValue;
    send("c" + pad3(servo));
}

// Heber um einen Schritt bewegen (positiv = hoch, negativ = runter)
function moveLifter(step) {
    updateLifter(Number(lifterSlider.value) + step);
}

// Slider: sendet live den Wert
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
