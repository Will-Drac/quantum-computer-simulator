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



    let state = new State(3)

    const X = new Gate("X")
    const H = new Gate("H")
    const CCX = new Gate("CCX")
    const CSWAP = new Gate("CSWAP")
    const RY = new Gate("RY", [Math.PI / 2])
    const RZ = new Gate("RZ", [Math.PI / 4])
    const U = new Gate("U", [Math.PI / 6, Math.PI / 4, Math.PI / 3])
    const CU = new Gate("CU", [4.23, 0.6, 5.3, Math.PI / 2])
    const CX = new Gate("CX")

    state = await (new Gate("RY", [Math.PI / 4])).apply(state, [0])
    state = await (new Gate("RY", [Math.PI / 6])).apply(state, [1])
    state = await (new Gate("RY", [Math.PI / 2])).apply(state, [2])

    state = await (new Gate("RZ", [Math.PI / 5])).apply(state, [1])
    state = await (new Gate("RZ", [Math.PI / 4])).apply(state, [2])

    state = await state.set(2, 0)

    // state = await (new Gate("RX", [Math.PI/2])).apply(state, [1])
    // state = await (new Gate("X")).apply(state, [2])

    console.log(await state.vector.real.getEntries(), await state.vector.imaginary.getEntries())
    console.log(await state.getProbabilities())
}

main()

/*

*/