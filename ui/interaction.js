// adds a qbit to the circuit
function createQbit(position) {
    const tracksDiv = document.getElementById("circuitTracks")

    // go through the current tracks and shift their position to make room
    const allTracks = tracksDiv.children
    for (i = 0; i < allTracks.length; i++) {
        const a = allTracks[i].getAttribute("qindex")
        if (a && a >= position) {
            allTracks[i].setAttribute("qindex", parseInt(a) + 1)
        }
    }

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
    for (i = 0; i < allTracks.length; i++) {
        const a = allTracks[i].getAttribute("qindex")
        if (a && a > position) {
            allTracks[i].setAttribute("qindex", parseInt(a) - 1)
        }
    }

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

    if (trackDiv.parentElement.childNodes.length !== 1){
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
        document.querySelectorAll(".moved").forEach(r => { r.remove() })
    })

    g.addEventListener("click", e => {
        console.log(g.innerText)
    })

    g.draggable = true
}

document.querySelectorAll(".gate").forEach(g => { setupGateInteraction(g) })

/*
TODO

clicking on a gate asks for its inputs, automatically fills input also

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