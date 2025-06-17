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

    // let state = new State(12)

    // const H = new SingleGate("H")
    // state = await H.apply(state, 1)

    // const P = new SingleGate("P", Math.PI/2)
    // state = await P.apply(state, 1)

    // const SX = new SingleGate("SX")
    // state = await SX.apply(state, 1)

    // console.log(await state.getProbabilities())



    let state = new State(2)

    state = await (new Gate("RY", [Math.PI/2.5])).apply(state, [0])
    state = await (new Gate("CX")).apply(state, [0, 1])
    state = await (new Gate("RY", [Math.PI/4])).apply(state, [0])

    state = await state.reset(0)

    // const measurementResult = await state.measure(0)
    // state = measurementResult.state
    // console.log(measurementResult.measurement)

    console.log(await state.vector.real.getEntries(), await state.vector.imaginary.getEntries())
    console.log(await state.getProbabilities())
}

main()

/*

*/