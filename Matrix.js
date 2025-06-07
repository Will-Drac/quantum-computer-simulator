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
                data[i * paddedFloatsPerTexHorizontal + j] = this.entries[j][i]
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
                {binding: 0, resource: this.texture.createView()},
                {binding: 1, resource: otherMatrix.texture.createView()},
                {binding: 2, resource: resultTexture.createView()}
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

// a matrix with a real and imaginary component, represented as two different matrices
class ComplexMatrix {
    constructor(rows, columns, realTexture, imaginaryTexture) {
        this.rows = rows
        this.columns = columns

        this.real = new Matrix(rows, columns, realTexture)
        this.imaginary = new Matrix(rows, columns, imaginaryTexture)
    }

    async multiplyComplexVector(complexVector) {
        const realVector = await (
            await this.real.multiplyVector(complexVector.real)
        ).subtract(
            await this.imaginary.multiplyVector(complexVector.imaginary)
        )

        const imaginaryVector = await (
            await this.real.multiplyVector(complexVector.imaginary)
        ).add(
            await this.imaginary.multiplyVector(complexVector.real)
        )

        return new ComplexVector(
            this.rows,
            realVector.texture,
            imaginaryVector.texture
        )
    }

    async kronecker(otherComplexMatrix) {
        const realMatrix = await(
            await this.real.kronecker(otherComplexMatrix.real)
        ).subtract(
            await this.imaginary.kronecker(otherComplexMatrix.imaginary)
        )

        const imaginaryMatrix = await(
            await this.imaginary.kronecker(otherComplexMatrix.real)
        ).add(
            await this.real.kronecker(otherComplexMatrix.imaginary)
        )

        return new ComplexMatrix(
            this.rows*otherComplexMatrix.rows, this.columns*otherComplexMatrix.columns,
            realMatrix.texture,
            imaginaryMatrix.texture
        )
    }
}