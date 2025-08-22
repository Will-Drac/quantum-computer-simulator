// adds a qbit to the circuit
function createQbit(position) {
    const tracksDiv = document.getElementById("circuitTracks")

    const qbitTrack = document.createElement("div")
    qbitTrack.addEventListener("dragover", e => e.preventDefault())
    qbitTrack.addEventListener("drop", e => {
        e.preventDefault()
        if (draggedGate && e.target.classList.contains("qbitTrack")) {
            draggedGate.style.position = "absolute"
            draggedGate.style.left = 75 * Math.floor(e.offsetX / 75) + "px"
            qbitTrack.appendChild(draggedGate)

            enableGateDragging(draggedGate)

            document.querySelectorAll(".moved").forEach(e => { e.remove() })

            draggedGate = null
        }
    })
    qbitTrack.classList.add("qbitTrack")

    // const line = document.createElement("div")
    // line.classList.add("qbitLine")
    // qbitTrack.append(line)

    tracksDiv.append(qbitTrack)


    const qbitsDiv = document.getElementById("circuitQbits")

    const info = document.createElement("div")
    info.innerText = `q${position}`
    info.classList.add("qbitInfo")
    qbitsDiv.append(info)
}

createQbit(0)
createQbit(0)
createQbit(0)
createQbit(0)
createQbit(0)

createQbit(0)
createQbit(0)
createQbit(0)
createQbit(0)
createQbit(0)
createQbit(0)


let draggedGate = null
function enableGateDragging(g) {
    g.addEventListener("dragstart", e => {
        draggedGate = e.target.cloneNode(true)
        draggedGate.classList.add("placed")
        e.dataTransfer.effectAllowed = "copy"

        if (e.target.classList.contains("placed")) { e.target.classList.add("moved") }
    })
}

document.querySelectorAll(".gate").forEach(g => { enableGateDragging(g) })