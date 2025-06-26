// in the matrix textures, width is the number of rows and height is the number of columns, because webgpu says there must be a multiple of 256 bytes per horizontal line of the image, but we have a lot of vector which are all vertical

async function loadWGSL(url) {
    const resp = await fetch(url)
    return await resp.text()
}

class Matrix {
    constructor(rows, columns, texture) {
        this.rows = rows
        this.columns = columns
        this.texture = texture ? texture : device.createTexture({
            dimension: "2d",
            size: [this.rows, this.columns, 1],
            format: "r32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })
    }

    // updates the texture based on the entries
    getTexture() {
        const unpaddedBytesPerTexHorizontal = this.rows * 4
        const paddedBytesPerTexHorizontal = Math.ceil(unpaddedBytesPerTexHorizontal / 256) * 256
        const paddedFloatsPerTexHorizontal = paddedBytesPerTexHorizontal / 4

        const data = new Float32Array(this.columns * paddedFloatsPerTexHorizontal)
        for (let i = 0; i < this.columns; i++) {
            for (let j = 0; j < this.rows; j++) {
                data[i * paddedFloatsPerTexHorizontal + j] = this.entries ? this.entries[j][i] : 0
            }
        }

        const stagingBuffer = device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        })

        new Float32Array(stagingBuffer.getMappedRange()).set(data)
        stagingBuffer.unmap()

        const commandEncoder = device.createCommandEncoder()


        commandEncoder.copyBufferToTexture(
            {
                buffer: stagingBuffer,
                bytesPerRow: paddedBytesPerTexHorizontal
            },
            {
                texture: this.texture
            },
            [this.rows, this.columns, 1]
        )

        const commandBuffer = commandEncoder.finish()
        device.queue.submit([commandBuffer])

        return this.texture
    }

    async getEntries() {
        if (!this.entries) { this.entries = Array.from({ length: this.rows }, () => Array(this.columns)) }

        const unpaddedBytesPerTexHorizontal = this.rows * 4
        const paddedBytesPerTexHorizontal = Math.ceil(unpaddedBytesPerTexHorizontal / 256) * 256
        const paddedFloatsPerTexHorizontal = paddedBytesPerTexHorizontal / 4
        const bufferSize = paddedBytesPerTexHorizontal * this.columns

        const readBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })

        const readEncoder = device.createCommandEncoder()
        readEncoder.copyTextureToBuffer(
            { texture: this.texture },
            {
                buffer: readBuffer,
                bytesPerRow: paddedBytesPerTexHorizontal,
                rowsPerImage: this.columns
            },
            [this.rows, this.columns, 1]
        )

        device.queue.submit([readEncoder.finish()])

        await readBuffer.mapAsync(GPUMapMode.READ)
        const mappedRange = readBuffer.getMappedRange()
        const data = new Float32Array(mappedRange)

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                this.entries[i][j] = data[j * paddedFloatsPerTexHorizontal + i]
            }
        }

        return this.entries
    }

    // assumes the other matrix is of the same size
    async add(otherMatrix) {
        const addModule = device.createShaderModule({
            label: "matrix addition module",
            code: await loadWGSL("./shaders/add.wgsl")
        })

        const addPipeline = device.createComputePipeline({
            label: "matrix addition pipeline",
            layout: "auto",
            compute: {
                module: addModule
            }
        })

        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [this.rows, this.columns, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const addBindGroup = device.createBindGroup({
            label: "matrix addition bind group",
            layout: addPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: otherMatrix.texture.createView() },
                { binding: 2, resource: resultTexture.createView() }
            ]
        })

        const addEncoder = device.createCommandEncoder()
        const addPass = addEncoder.beginComputePass()
        addPass.setPipeline(addPipeline)
        addPass.setBindGroup(0, addBindGroup)
        addPass.dispatchWorkgroups(this.rows, this.columns)
        addPass.end()

        const addCommandBuffer = addEncoder.finish()
        device.queue.submit([addCommandBuffer])

        return new Matrix(this.rows, this.columns, resultTexture)
    }

    // assumes the other matrix is of the same size
    async subtract(otherMatrix) {
        const subtractModule = device.createShaderModule({
            label: "matrix addition module",
            code: await loadWGSL("./shaders/subtract.wgsl")
        })

        const subtractPipeline = device.createComputePipeline({
            label: "matrix addition pipeline",
            layout: "auto",
            compute: {
                module: subtractModule
            }
        })

        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [this.rows, this.columns, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const subtractBindGroup = device.createBindGroup({
            label: "matrix addition bind group",
            layout: subtractPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: otherMatrix.texture.createView() },
                { binding: 2, resource: resultTexture.createView() }
            ]
        })

        const subtractEncoder = device.createCommandEncoder()
        const subtractPass = subtractEncoder.beginComputePass()
        subtractPass.setPipeline(subtractPipeline)
        subtractPass.setBindGroup(0, subtractBindGroup)
        subtractPass.dispatchWorkgroups(this.rows, this.columns)
        subtractPass.end()

        const subtractCommandBuffer = subtractEncoder.finish()
        device.queue.submit([subtractCommandBuffer])

        return new Matrix(this.rows, this.columns, resultTexture)
    }

    async multiplyScalar(scalar) {
        const mModule = device.createShaderModule({
            label: "matrix multiply scalar module",
            code: (await loadWGSL("./shaders/multiplyScalar.wgsl")).replace("_SCALAR", scalar)
        })

        const msPipeline = device.createComputePipeline({
            label: "matrix multiply scalar pipeline",
            layout: "auto",
            compute: {
                module: mModule
            }
        })

        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [this.rows, this.columns, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const mBindGroup = device.createBindGroup({
            label: "matrix multiply scalar bind group",
            layout: msPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: resultTexture.createView() }
            ]
        })

        const mEncoder = device.createCommandEncoder()
        const mPass = mEncoder.beginComputePass()
        mPass.setPipeline(msPipeline)
        mPass.setBindGroup(0, mBindGroup)
        mPass.dispatchWorkgroups(this.rows, this.columns, 1)
        mPass.end()

        device.queue.submit([mEncoder.finish()])

        return new Matrix(this.rows, this.columns, resultTexture)
    }

    async multiply(otherMatrix) {
        if (this.columns !== otherMatrix.rows) { console.log(`MATRIX MULTIPLICATION FAILED, ${this.columns} != ${otherMatrix.rows}`); return null }

        const multiplyModule = device.createShaderModule({
            label: "matrix multiplication module",
            code: await loadWGSL("./shaders/multiply.wgsl")
        })

        const multiplyPipeline = device.createComputePipeline({
            label: "matrix multiplication pipeline",
            layout: "auto",
            compute: {
                module: multiplyModule
            }
        })

        const resultMatrixRows = this.rows
        const resultMatrixColumns = otherMatrix.columns

        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [resultMatrixRows, resultMatrixColumns, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const multiplyBindGroup = device.createBindGroup({
            label: "matrix multiplication bind group",
            layout: multiplyPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: otherMatrix.texture.createView() },
                { binding: 2, resource: resultTexture.createView() }
            ]
        })

        const multiplyEncoder = device.createCommandEncoder()
        const multiplyPass = multiplyEncoder.beginComputePass()
        multiplyPass.setPipeline(multiplyPipeline)
        multiplyPass.setBindGroup(0, multiplyBindGroup)
        multiplyPass.dispatchWorkgroups(resultMatrixRows, resultMatrixColumns)
        multiplyPass.end()

        const multiplyCommandBuffer = multiplyEncoder.finish()
        device.queue.submit([multiplyCommandBuffer])

        return new Matrix(this.rows, otherMatrix.columns, resultTexture)
    }

    async multiplyVector(vector) {
        if (this.columns !== vector.dimension) { console.log(`MATRIX-VECTOR MULTIPLICATION FAILED, ${this.columns} != ${vector.dimension}`); return null }

        const multiplyModule = device.createShaderModule({
            label: "matrix-vector multiplication module",
            code: await loadWGSL("./shaders/multiplyVector.wgsl")
        })

        const multiplyPipeline = device.createComputePipeline({
            label: "matrix-vector multiplication pipeline",
            layout: "auto",
            compute: {
                module: multiplyModule
            }
        })

        const multiplyResultTexture = device.createTexture({
            dimension: "2d",
            size: [this.rows, this.columns, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const multiplyBindGroup = device.createBindGroup({
            label: "matrix-vector multiplication bind group",
            layout: multiplyPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: vector.texture.createView() },
                { binding: 2, resource: multiplyResultTexture.createView() }
            ]
        })

        const setupEncoder = device.createCommandEncoder()
        const multiplyPass = setupEncoder.beginComputePass()
        multiplyPass.setPipeline(multiplyPipeline)
        multiplyPass.setBindGroup(0, multiplyBindGroup)
        multiplyPass.dispatchWorkgroups(this.rows, this.columns)

        multiplyPass.end()

        // new we have a matrix which is the same size as "this", but we need to collapse its columns by adding them all together, and we'll get the result of the multiplication
        // that will be done with a gpu parallel reduction

        const reduceModule = device.createShaderModule({
            label: "matrix-vector result reduction module",
            code: await loadWGSL("./shaders/reduce.wgsl")
        })

        const reducePipeline = device.createComputePipeline({
            label: "matrix-vector result reduction pipeline",
            layout: "auto",
            compute: {
                module: reduceModule
            }
        })

        const workTexture = device.createTexture({
            dimension: "2d",
            size: [this.rows, this.columns, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        setupEncoder.copyTextureToTexture(
            { texture: multiplyResultTexture },
            { texture: workTexture },
            [this.rows, this.columns, 1]
        )

        const reduceUniformBuffer = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        const reduceBindGroup = device.createBindGroup({
            label: "matrix-vector result reduction bind group",
            layout: reducePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: workTexture.createView() },
                { binding: 1, resource: { buffer: reduceUniformBuffer } }
            ]
        })

        device.queue.submit([setupEncoder.finish()])

        const numSteps = Math.ceil(Math.log2(this.columns)) // the number of reduction steps it will take
        for (let i = 0; i < numSteps; i++) {

            const thisReduceEncoder = device.createCommandEncoder()
            const thisPass = thisReduceEncoder.beginComputePass()

            const stride = 2 ** i // a stride of 1 means no entries are skipped and each pair is added, so it takes columns/2 workgroups. if stride is 2, every second entry is ignored and it takes columns/4 workgroups
            const numWorkgroups = Math.ceil(this.columns / (2 * stride))

            const reduceUniformArray = new Uint32Array(2)
            reduceUniformArray.set([stride, numWorkgroups])

            device.queue.writeBuffer(reduceUniformBuffer, 0, reduceUniformArray)

            thisPass.setPipeline(reducePipeline)
            thisPass.setBindGroup(0, reduceBindGroup)
            thisPass.dispatchWorkgroups(this.rows, numWorkgroups, 1)

            thisPass.end()

            device.queue.submit([thisReduceEncoder.finish()])
        }

        // now workTexture has the resulting vector in its first column, we need to get it out
        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [this.rows, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const resultCopyEncoder = device.createCommandEncoder()
        resultCopyEncoder.copyTextureToTexture(
            { texture: workTexture },
            { texture: resultTexture },
            [this.rows, 1, 1]
        )

        device.queue.submit([resultCopyEncoder.finish()])

        return new Vector(this.rows, resultTexture)
    }

    async kronecker(otherMatrix) {
        const kModule = device.createShaderModule({
            label: "kronecker product module",
            code: await loadWGSL("./shaders/kronecker.wgsl")
        })

        const kPipeline = device.createComputePipeline({
            label: "kronecker product pipeline",
            layout: "auto",
            compute: {
                module: kModule
            }
        })

        const resultMatrixRows = this.rows * otherMatrix.rows
        const resultMatrixColumns = this.columns * otherMatrix.columns

        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [resultMatrixRows, resultMatrixColumns],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const kBindGroup = device.createBindGroup({
            label: "kronecker product bind group",
            layout: kPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: otherMatrix.texture.createView() },
                { binding: 2, resource: resultTexture.createView() }
            ]
        })

        const kEncoder = device.createCommandEncoder()
        const kPass = kEncoder.beginComputePass()
        kPass.setPipeline(kPipeline)
        kPass.setBindGroup(0, kBindGroup)
        kPass.dispatchWorkgroups(resultMatrixRows, resultMatrixColumns, 1)
        kPass.end()

        device.queue.submit([kEncoder.finish()])

        return new Matrix(resultMatrixRows, resultMatrixColumns, resultTexture)
    }
}

// creates an identity matrix of a particular size
class IMatrix extends Matrix {
    constructor(size) {
        super(size, size)

        this.entries = Array.from({ length: this.rows }, () => Array(this.columns).fill(0))
        for (let i = 0; i < size; i++) {
            this.entries[i][i] = 1
        }

        this.getTexture()
    }
}

// a matrix with a real and imaginary component, represented as two different matrices
class ComplexMatrix {
    constructor(rows, columns, realTexture, imaginaryTexture, hasReal, hasImaginary) {
        this.rows = rows
        this.columns = columns

        this.real = new Matrix(rows, columns, realTexture)
        this.imaginary = new Matrix(rows, columns, imaginaryTexture)

        this.hasReal = hasReal !== undefined ? hasReal : true
        this.hasImaginary = hasImaginary !== undefined ? hasImaginary : true
    }

    async multiplyComplexVector(complexVector) {
        let realVector = { texture: undefined }, imaginaryVector = { texture: undefined }
        let hasReal, hasImaginary

        // optimized to only do multiplication if it's non-zero
        if ((this.hasReal && complexVector.hasReal) || (this.hasImaginary && complexVector.hasImaginary)) {
            if ((this.hasReal && complexVector.hasReal) && (this.hasImaginary && complexVector.hasImaginary)) {
                realVector = await (
                    await this.real.multiplyVector(complexVector.real)
                ).subtract(
                    await this.imaginary.multiplyVector(complexVector.imaginary)
                )
            }
            else if (this.hasReal && complexVector.hasReal) {
                realVector = await this.real.multiplyVector(complexVector.real)
            }
            else if (this.hasImaginary && complexVector.hasImaginary) {
                realVector = await (await this.imaginary.multiplyVector(complexVector.imaginary)).multiplyScalar(-1)
            }

            hasReal = true
        }
        else {
            hasReal = false
        }

        if ((this.hasReal && complexVector.hasImaginary) || (this.hasImaginary && complexVector.hasReal)) {
            if ((this.hasReal && complexVector.hasImaginary) && (this.hasImaginary && complexVector.hasReal)) {
                imaginaryVector = await (
                    await this.real.multiplyVector(complexVector.imaginary)
                ).add(
                    await this.imaginary.multiplyVector(complexVector.real)
                )
            }
            else if (this.hasReal && complexVector.hasImaginary) {
                imaginaryVector = await this.real.multiplyVector(complexVector.imaginary)
            }
            else if (this.hasImaginary && complexVector.hasReal) {
                imaginaryVector = await this.imaginary.multiplyVector(complexVector.real)
            }

            hasImaginary = true
        }
        else {
            hasImaginary = false
        }

        return new ComplexVector(
            this.rows,
            realVector.texture,
            imaginaryVector.texture,
            hasReal,
            hasImaginary
        )
    }

    async kronecker(otherComplexMatrix) {
        const realMatrix = await (
            await this.real.kronecker(otherComplexMatrix.real)
        ).subtract(
            await this.imaginary.kronecker(otherComplexMatrix.imaginary)
        )

        const imaginaryMatrix = await (
            await this.imaginary.kronecker(otherComplexMatrix.real)
        ).add(
            await this.real.kronecker(otherComplexMatrix.imaginary)
        )

        return new ComplexMatrix(
            this.rows * otherComplexMatrix.rows, this.columns * otherComplexMatrix.columns,
            realMatrix.texture,
            imaginaryMatrix.texture,
            this.hasReal || otherComplexMatrix.hasReal, //the simple or is a rough approximation but maybe good enough
            this.hasImaginary || otherComplexMatrix.hasImaginary
        )
    }

    // !only works on 2x2 unitary matrices, by design
    async inverse() {
        const newMatrix = new ComplexMatrix(2, 2, undefined, undefined, this.hasReal, this.hasImaginary)

        if (this.hasReal) {
            const real = await this.real.getEntries()
            const realTransposed = [
                [real[0][0], real[1][0]],
                [real[0][1], real[1][1]]
            ]

            newMatrix.real.entries = realTransposed
            newMatrix.real.getTexture()
        }

        if (this.hasImaginary) {
            const imaginary = await this.imaginary.getEntries()
            const imaginaryNegativeTransposed = [
                [-imaginary[0][0], -imaginary[1][0]],
                [-imaginary[0][1], -imaginary[1][1]]
            ]

            newMatrix.imaginary.entries = imaginaryNegativeTransposed
            newMatrix.imaginary.getTexture()
        }

        return newMatrix
    }

    // !only works on 2x2 unitary matrices, by design
    async power(exponent) { //raises the matrix to a power

        // A^k = P K^k P^-1

        const real = await this.real.getEntries()
        const imag = await this.imaginary.getEntries()

        const tr = real[0][0] + real[1][1]
        const ti = imag[0][0] + imag[1][1]

        const dr = real[0][0] * real[1][1] - imag[0][0] * imag[1][1] - real[1][0] * real[0][1] + imag[1][0] * imag[0][1]
        const di = real[0][0] * imag[1][1] + imag[0][0] * real[1][1] - real[1][0] * imag[0][1] - imag[1][0] * real[0][1]

        const Dr = tr ** 2 - ti ** 2 - 4 * dr
        const Di = 2 * tr * ti - 4 * di

        const R = Math.sqrt(Dr ** 2 + Di ** 2)

        const sr = Math.sqrt((R + Dr) / 2)
        const si = (Di == 0 ? 1 : Math.sign(Di)) * Math.sqrt((R - Dr) / 2)

        // the eigenvalues
        const lambda1r = (tr + sr) / 2
        const lambda1i = (ti + si) / 2

        const lambda2r = (tr - sr) / 2
        const lambda2i = (ti - si) / 2

        // lambda 1 and 2 after being exponentiated
        // first convert to polar
        const r1 = Math.sqrt(lambda1r ** 2 + lambda1i ** 2)
        const theta1 = Math.atan2(lambda1i, lambda1r)

        const r2 = Math.sqrt(lambda2r ** 2 + lambda2i ** 2)
        const theta2 = Math.atan2(lambda2i, lambda2r)

        // then exponentiate and convert back to components
        const lambda1kr = r1 ** exponent * Math.cos(exponent * theta1)
        const lambda1ki = r1 ** exponent * Math.sin(exponent * theta1)

        const lambda2kr = r2 ** exponent * Math.cos(exponent * theta2)
        const lambda2ki = r2 ** exponent * Math.sin(exponent * theta2)

        // finding eigenvectors
        // solutions to (A - lambda I) v = 0  let B = (A - lambda I) for both lambda

        const B1r = [
            [real[0][0] - lambda1r, real[0][1]],
            [real[1][0], real[1][1] - lambda1r]
        ]
        const B1i = [
            [imag[0][0] - lambda1i, imag[0][1]],
            [imag[1][0], imag[1][1] - lambda1i]
        ]

        const B2r = [
            [real[0][0] - lambda2r, real[0][1]],
            [real[1][0], real[1][1] - lambda2r]
        ]
        const B2i = [
            [imag[0][0] - lambda2i, imag[0][1]],
            [imag[1][0], imag[1][1] - lambda2i]
        ]

        // finding a solution for B1 and B2

        function getNullSolutions(Mr, Mi) {
            // debugger
            if (Mr[0][0] == 0 && Mi[0][0] == 0) {
                if (Mr[1][0] == 0 && Mi[1][0] == 0) {
                    /*
                    0 a => [anything, 0], choose [1, 0]
                    0 b
                    */
                    return { real: [1, 0], imaginary: [0, 0] }
                }
                else {
                    /*
                    0 a? => swap rows
                    c d?
                    */
                    Mr[0][0] = Mr[1][0]; Mr[0][1] = Mr[1][1]
                    Mi[0][0] = Mi[1][0]; Mi[0][1] = Mi[1][1]
                }
            }

            /*
            a  b?
            c? d?
            */

            if (Mr[1][0] !== 0 || Mi[1][0] !== 0) {
                // R2 = R2 - c/a R1
                // but |M| = 0 => b - cd/a = 0 so the second row becomes 0
                Mr[1][0] = 0; Mi[1][0] = 0; Mr[1][1] = 0; Mi[1][1] = 0
            }
            /* else
                a b? => a b?  b/c  ad - bc = 0
                0 d?    0 0
            */

            if (Mr[0][1] == 0 && Mi[0][1] == 0) {
                /*
                a 0 => [0, anything] choose [0, 1]
                0 0
                */
                return { real: [0, 1], imaginary: [0, 0] }
            }
            else {
                /*
                a b => ax + by = 0 => choose y = 1 => x = -b/a
                0 0
                */
                const ar = Mr[0][0]; const ai = Mi[0][0]
                const br = Mr[0][1]; const bi = Mi[0][1]
                const d = ar ** 2 + ai ** 2
                return { real: [-(ar * br + ai * bi) / d, 1], imaginary: [(ai * br - ar * bi) / d, 0] }
            }
        }

        const v1 = getNullSolutions(B1r, B1i)
        const v2 = getNullSolutions(B2r, B2i)

        // normalizing the solutions

        const v1L = Math.sqrt(v1.real[0] ** 2 + v1.real[1] ** 2 + v1.imaginary[0] ** 2 + v1.imaginary[1] ** 2)
        const v2L = Math.sqrt(v2.real[0] ** 2 + v2.real[1] ** 2 + v2.imaginary[0] ** 2 + v2.imaginary[1] ** 2)

        v1.real[0] = v1.real[0] / v1L; v1.imaginary[0] = v1.imaginary[0] / v1L
        v1.real[1] = v1.real[1] / v1L; v1.imaginary[1] = v1.imaginary[1] / v1L

        v2.real[0] = v2.real[0] / v2L; v2.imaginary[0] = v2.imaginary[0] / v2L
        v2.real[1] = v2.real[1] / v2L; v2.imaginary[1] = v2.imaginary[1] / v2L


        const Pr = [
            [v1.real[0], v2.real[0]],
            [v1.real[1], v2.real[1]]
        ]

        const Pi = [
            [v1.imaginary[0], v2.imaginary[0]],
            [v1.imaginary[1], v2.imaginary[1]]
        ]

        const PDagr = [
            [Pr[0][0], Pr[1][0]],
            [Pr[0][1], Pr[1][1]]
        ]
        const PDagi = [
            [-Pi[0][0], -Pi[1][0]],
            [-Pi[0][1], -Pi[1][1]]
        ]

        function cMultR(r1, i1, r2, i2) {
            return r1 * r2 - i1 * i2
        }
        function cMultI(r1, i1, r2, i2) {
            return r1 * i2 + i1 * r2
        }

        // K P^-1
        const K_PDag_r = [
            [cMultR(lambda1kr, lambda1ki, PDagr[0][0], PDagi[0][0]), cMultR(lambda1kr, lambda1ki, PDagr[0][1], PDagi[0][1])],
            [cMultR(lambda2kr, lambda2ki, PDagr[1][0], PDagi[1][0]), cMultR(lambda2kr, lambda2ki, PDagr[1][1], PDagi[1][1])]
        ]
        const K_PDag_i = [
            [cMultI(lambda1kr, lambda1ki, PDagr[0][0], PDagi[0][0]), cMultI(lambda1kr, lambda1ki, PDagr[0][1], PDagi[0][1])],
            [cMultI(lambda2kr, lambda2ki, PDagr[1][0], PDagi[1][0]), cMultI(lambda2kr, lambda2ki, PDagr[1][1], PDagi[1][1])]
        ]

        const testR = [
            [
                cMultR(Pr[0][0], Pi[0][0], PDagr[0][0], PDagi[0][0]) + cMultR(Pr[0][1], Pi[0][1], PDagr[1][0], PDagi[1][0]),
                cMultR(Pr[0][0], Pi[0][0], PDagr[0][1], PDagi[0][1]) + cMultR(Pr[0][1], Pi[0][1], PDagr[1][1], PDagi[1][1]),
            ],
            [
                cMultR(Pr[1][0], Pi[1][0], PDagr[0][0], PDagi[0][0]) + cMultR(Pr[1][1], Pi[1][1], PDagr[1][0], PDagi[1][0]),
                cMultR(Pr[1][0], Pi[1][0], PDagr[0][1], PDagi[0][1]) + cMultR(Pr[1][1], Pi[1][1], PDagr[1][1], PDagi[1][1]),
            ]
        ]
        const testI = [
            [
                cMultI(Pr[0][0], Pi[0][0], PDagr[0][0], PDagi[0][0]) + cMultI(Pr[0][1], Pi[0][1], PDagr[1][0], PDagi[1][0]),
                cMultI(Pr[0][0], Pi[0][0], PDagr[0][1], PDagi[0][1]) + cMultI(Pr[0][1], Pi[0][1], PDagr[1][1], PDagi[1][1]),
            ],
            [
                cMultI(Pr[1][0], Pi[1][0], PDagr[0][0], PDagi[0][0]) + cMultI(Pr[1][1], Pi[1][1], PDagr[1][0], PDagi[1][0]),
                cMultI(Pr[1][0], Pi[1][0], PDagr[0][1], PDagi[0][1]) + cMultI(Pr[1][1], Pi[1][1], PDagr[1][1], PDagi[1][1]),
            ]
        ]

        // P (K P^-1) = A^k
        const A_K_r = [
            [
                cMultR(Pr[0][0], Pi[0][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultR(Pr[0][1], Pi[0][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultR(Pr[0][0], Pi[0][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultR(Pr[0][1], Pi[0][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ],
            [
                cMultR(Pr[1][0], Pi[1][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultR(Pr[1][1], Pi[1][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultR(Pr[1][0], Pi[1][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultR(Pr[1][1], Pi[1][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ]
        ]
        const A_K_i = [
            [
                cMultI(Pr[0][0], Pi[0][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultI(Pr[0][1], Pi[0][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultI(Pr[0][0], Pi[0][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultI(Pr[0][1], Pi[0][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ],
            [
                cMultI(Pr[1][0], Pi[1][0], K_PDag_r[0][0], K_PDag_i[0][0]) + cMultI(Pr[1][1], Pi[1][1], K_PDag_r[1][0], K_PDag_i[1][0]),
                cMultI(Pr[1][0], Pi[1][0], K_PDag_r[0][1], K_PDag_i[0][1]) + cMultI(Pr[1][1], Pi[1][1], K_PDag_r[1][1], K_PDag_i[1][1]),
            ]
        ]

        const newMatrix = new ComplexMatrix(2, 2, undefined, undefined, true, true)

        newMatrix.real.entries = A_K_r
        newMatrix.imaginary.entries = A_K_i

        await newMatrix.real.getTexture()
        await newMatrix.imaginary.getTexture()

        return newMatrix
    }
}

// creates a complex identity matrix of a particular size
// note: this.imaginary.entries is not immediately defined
class IComplexMatrix extends ComplexMatrix {
    constructor(size) {
        super(size, size, undefined, undefined, true, false)

        this.real.entries = Array.from({ length: this.rows }, () => Array(this.columns).fill(0))
        for (let i = 0; i < size; i++) {
            this.real.entries[i][i] = 1
        }

        this.real.getTexture()
    }
}