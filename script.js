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

    let state = new ComplexVector(2**12)
    await state.real.getEntries()
    state.real.entries[0] = 1
    state.real.getTexture()

    const H = new SingleGate("H")
    await H.getStateMatrix(12, 1)
    state = await H.stateMatrix.multiplyComplexVector(state)

    const P = new SingleGate("P", Math.PI/2)
    await P.getStateMatrix(12, 1)
    state = await P.stateMatrix.multiplyComplexVector(state)

    const SX = new SingleGate("SX")
    await SX.getStateMatrix(12, 1)
    state = await SX.stateMatrix.multiplyComplexVector(state)

    await state.calculateModSquare()

    console.log(await state.getModSquare())
}

main()

/*

*/