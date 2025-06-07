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


    // let a1 = new Matrix(20, 20)
    // let a2 = new Matrix(20, 20)
    // for (let i = 0; i < 20; i++) {
    //     for (let j = 0; j < 20; j++) {
    //         const v = Math.random()
    //         a1.entries[i][j] = v
    //         a2.entries[i][j] = -v
    //     }
    // }
    // a1.getTexture()
    // a2.getTexture()

    // let b = new Matrix(20, 20)
    // for (let i = 0; i < 20; i++) {
    //     b.entries[i][i] = 2
    // }
    // b.getTexture()

    // for (let i = 0; i < 100; i++) {
    //     const ba1 = await b.matrixTexture.multiply(a1.matrixTexture)
    //     const ba2 = await b.matrixTexture.multiply(a2.matrixTexture)

    //     const sum = await ba1.add(ba2)

    //     console.log(await sum.getMatrix())
    // }

    let A = new Matrix(4, 3)
    let v = new Vector(3)

    A.entries = [
        [2, 1, 3],
        [3, 4, 1],
        [1, 2, 2],
        [5, 2, 1]
    ]

    v.entries = [
        1,
        4,
        7
    ]

    A.getTexture()
    v.getTexture()

    const result = await A.multiplyVector(v)
    console.log(await result.getEntries())
}

main()

/*

*/