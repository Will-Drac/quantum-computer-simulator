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

    const X = new SingleGate("X")
    const CNOT = new DoubleGate("CNOT")

    state = await X.apply(state, 0)
    state = await CNOT.apply(state, 1, 0)

    console.log("after swap back", await state.getProbabilities())
}

main()

/*

*/