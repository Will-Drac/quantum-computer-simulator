let adapter, device

async function loadWGSL(url) {
    const resp = await fetch(url)
    return await resp.text()
}

async function main() {
    adapter = await navigator.gpu?.requestAdapter()
    device = await adapter?.requestDevice()
    if (!device) {
        alert("need a browser that supports WebGPU")
        return
    }

    // let state = new State(3)

    // let G = new Gate("GPHASE", [3*Math.PI/4])

    // G = await G.addControl()
    // G = await G.addNegativeControl()

    // const SM = await G.getStateMatrixGPhase(3, [2, 1])

    // state = await (new Gate("X")).apply(state, [1])
    // state = await (new Gate("X")).apply(state, [0])

    // state = await G.apply(state, [2, 1])


    // console.log(await state.vector.real.getEntries(), await state.vector.imaginary.getEntries())
    // console.log(await state.getProbabilities())

    let G = new Gate("RY", [-Math.PI])
    G = await G.power(-1)

    console.log(await G.originalMatrix.real.getEntries(), await G.originalMatrix.imaginary.getEntries())
}

main()

/*

*/