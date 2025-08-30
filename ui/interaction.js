// adds a qbit to the circuit
function createQbit(position) {
    const tracksDiv = document.getElementById("circuitTracks")

    // go through the current tracks and shift their position to make room
    const allTracks = tracksDiv.children
    let newTracks = {}
    for (i = 0; i < allTracks.length; i++) {

        const a = parseInt(allTracks[i].getAttribute("qindex"))

        if (a && a >= position) {
            allTracks[i].setAttribute("qindex", a + 1)
            newTracks[String(a + 1)] = tracks[a]
        }
        else {
            newTracks[a] = tracks[a]
        }
    }
    tracks = newTracks

    const div = document.createElement("div")
    div.setAttribute("qindex", position)
    tracksDiv.insertBefore(div, tracksDiv.childNodes[position])


    const trackDiv = document.createElement("div")
    div.append(trackDiv)


    const trackBackground = document.createElement("div")
    trackBackground.addEventListener("dragover", e => e.preventDefault())
    trackBackground.addEventListener("drop", e => {
        e.preventDefault()
        if (draggedGate && (e.target.classList.contains("trackBackground")) || (e.target.classList.contains("trackLine"))) {
            draggedGate.style.position = "absolute"
            draggedGate.style.left = 75 * Math.floor(e.offsetX / 75) + "px"
            trackBackground.appendChild(draggedGate)

            setupGateInteraction(draggedGate)

            addGateToTrack(e.target, draggedGate)

            draggedGate = null
        }
    })
    trackBackground.classList.add("trackBackground")
    trackDiv.append(trackBackground)

    const line = document.createElement("div")
    line.classList.add("trackLine")
    trackBackground.append(line)


    const editBar = document.createElement("div")
    editBar.classList.add("editBar")
    div.append(editBar)

    const editBarLine = document.createElement("div")
    editBarLine.classList.add("editBarLine")
    editBar.append(editBarLine)


    const circuitQbitsDiv = document.getElementById("circuitQbits")

    const info = document.createElement("div")
    info.innerText = `q${position}`
    info.classList.add("qbitInfo")
    circuitQbitsDiv.insertBefore(info, circuitQbitsDiv.childNodes[position])
}

function removeQbit(position) {
    const tracksDiv = document.getElementById("circuitTracks")

    // decrease the index of all after
    const allTracks = tracksDiv.children
    let newTracks = {}
    for (i = 0; i < allTracks.length; i++) {

        const a = parseInt(allTracks[i].getAttribute("qindex"))

        if (a && a > position) {
            allTracks[i].setAttribute("qindex", a - 1)
            newTracks[a - 1] = tracks[a]
        }
        else {
            newTracks[a] = tracks[a]
        }
    }
    delete newTracks[allTracks.length - 1]
    tracks = newTracks

    tracksDiv.childNodes[position].remove()

    const circuitQbitsDiv = document.getElementById("circuitQbits")
    circuitQbitsDiv.childNodes[position].remove()
}

function createTrackEditBox(position, barClicked) {
    const oldBox = document.getElementById("trackEditBox")
    if (oldBox) { oldBox.remove() }

    const trackDiv = barClicked.parentElement
    const clickedIndex = parseInt(trackDiv.getAttribute("qindex"))

    const div = document.createElement("div")
    div.id = "trackEditBox"
    div.style = `
        left: ${position.x}px;
        top: ${position.y}px;
    `

    document.getElementById("circuitArea").append(div)

    if (trackDiv.parentElement.childNodes.length !== 1) {
        const remove = document.createElement("p")
        remove.innerText = "↑Remove Track Above"
        remove.addEventListener("click", e => {
            removeQbit(clickedIndex)
        })
        div.append(remove)
    }

    const add = document.createElement("p")
    add.innerText = "↓Add Track Below"
    add.addEventListener("click", e => {
        createQbit(clickedIndex + 1)
    })
    div.append(add)
}

// closing the track edit box
document.getElementById("circuitArea").addEventListener("scroll", e => {
    const oldBox = document.getElementById("trackEditBox")
    if (oldBox) { oldBox.remove() }
})
document.getElementById("circuitArea").addEventListener("click", e => {
    if (e.target.classList.contains("editBar")) {
        createTrackEditBox({ x: e.x, y: e.y }, e.target)
    }
    else if (e.target.classList.contains("editBarLine")) {
        createTrackEditBox({ x: e.x, y: e.y }, e.target.parentElement)
    }

    else if (document.getElementById("trackEditBox") && e.target.id !== "trackEditBox") {
        const oldBox = document.getElementById("trackEditBox")
        if (oldBox) { oldBox.remove() }
    }
})

createQbit(0)
createQbit(1)
createQbit(2)
createQbit(3)


let draggedGate = null
function setupGateInteraction(g) {
    g.addEventListener("dragstart", e => {
        draggedGate = e.target.cloneNode(true)
        draggedGate.classList.add("placed")
        e.dataTransfer.effectAllowed = "copy"

        if (e.target.classList.contains("placed")) { e.target.classList.add("moved") }
    })

    g.addEventListener("dragend", e => {
        document.querySelectorAll(".moved").forEach(r => { removeGateFromTrack(r) })
    })

    g.addEventListener("click", e => {
        console.log(g.innerText)
    })

    g.draggable = true
}

document.querySelectorAll(".gate").forEach(g => { setupGateInteraction(g) })

function addGateToTrack(track, gate) {
    const trackNumber = parseInt(track.parentElement.parentElement.getAttribute("qIndex"))

    // gets an array of all unique inputs to this gate which must be defined
    const g = gates[gate.innerText]
    let uniqueInputs = []
    for (let i = 0; i < g.inputs.length; i++) {
        const input = g.inputs[i]
        if (typeof (input) == "string" && !uniqueInputs.includes(input)) {
            uniqueInputs.push(input)
        }
    }

    const inputsObject = {}
    for (let i = 0; i < uniqueInputs.length; i++) {
        inputsObject[uniqueInputs[i]] = 0
    }

    const qbitsObject = {}
    qbitsObject[g.qbits[0]] = trackNumber
    for (let i = 1; i < g.qbits.length; i++) {
        qbitsObject[g.qbits[i]] = undefined //qbits missing for inputs: this should alert the user
    }

    if (!tracks[String(trackNumber)]) { tracks[String(trackNumber)] = {} }
    tracks[String(trackNumber)][String(parseInt(gate.style.left) / 75)] = {
        gate: g,
        inputs: inputsObject,
        qbits: qbitsObject
    }
}

function removeGateFromTrack(gate) {
    const trackIndex = parseInt(gate.parentElement.parentElement.parentElement.getAttribute("qindex"))

    // if the gate is even placed down at all
    if (gate.style.left) {
        const posOnTrack = parseInt(gate.style.left) / 75
        delete tracks[trackIndex][posOnTrack]
    }

    gate.remove()
}

/*
TODO

each track has an array of the gates on it
    when you drop a gate, it puts itself into that array in the correct order
    includes:
        name (for lookup in gates object)
        inputs and their values (including qbits)
        modifiers
    the html object keeps a variable for its position in the array (left value/75)
    gate parameters autofill
    controls/additional qbits create a prompt that the gate is not yet properly defined after first placement
    if its a gate with more than one qbit, it creates a gate ui element (or something indicating a control) on the other tracks with reference to whichever the first applied qbit is

clicking on a gate asks for its inputs

add u and gphase gates to ui
    what to do about gphase...

whenever there's an edit, it goes through each track left to right and runs the quantum circuit

bloch sphere displays on the right

drawing the control(s) of controlled gates

selecting multiple gates at once
    grouping
    deleting
    moving
    copying?
*/