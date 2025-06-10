class Vector {
    constructor(dimension, texture) {
        this.dimension = dimension
        this.texture = texture ? texture : device.createTexture({
            dimension: "2d",
            size: [this.dimension, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })
    }

    // updates the texture based on the entries
    getTexture() {
        const unpaddedBytesPerTexHorizontal = this.dimension * 4
        const paddedBytesPerTexHorizontal = Math.ceil(unpaddedBytesPerTexHorizontal / 256) * 256
        const paddedFloatsPerTexHorizontal = paddedBytesPerTexHorizontal / 4

        const data = new Float32Array(paddedFloatsPerTexHorizontal)
        for (let i = 0; i < this.dimension; i++) {
            data[i] = this.entries[i]
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
            [this.dimension, 1, 1]
        )

        const commandBuffer = commandEncoder.finish()
        device.queue.submit([commandBuffer])

        return this.texture
    }

    async getEntries() {
        if (!this.entries) {this.entries = new Array(this.dimension).fill(0)}

        const unpaddedBytesPerTexHorizontal = this.dimension * 4
        const paddedBytesPerTexHorizontal = Math.ceil(unpaddedBytesPerTexHorizontal / 256) * 256
        const bufferSize = paddedBytesPerTexHorizontal * 1

        const readBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })

        const readEncoder = device.createCommandEncoder()
        readEncoder.copyTextureToBuffer(
            {texture: this.texture},
            {
                buffer: readBuffer,
                bytesPerRow: paddedBytesPerTexHorizontal,
                rowsPerImage: 1
            },
            [this.dimension, 1, 1]
        )

        device.queue.submit([readEncoder.finish()])

        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readBuffer.getMappedRange();
        const data = new Float32Array(mappedRange);

        for (let i = 0; i < this.dimension; i++) {
            this.entries[i] = data[i]
        }

        return this.entries
    }

    // assumes the other vector is of the same size
    async add(otherVector) {
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
            size: [this.dimension, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const addBindGroup = device.createBindGroup({
            label: "matrix addition bind group",
            layout: addPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: otherVector.texture.createView() },
                { binding: 2, resource: resultTexture.createView() }
            ]
        })

        const addEncoder = device.createCommandEncoder()
        const addPass = addEncoder.beginComputePass()
        addPass.setPipeline(addPipeline)
        addPass.setBindGroup(0, addBindGroup)
        addPass.dispatchWorkgroups(this.dimension, 1, 1)
        addPass.end()

        const addCommandBuffer = addEncoder.finish()
        device.queue.submit([addCommandBuffer])

        return new Vector(this.dimension, resultTexture)
    }

    // assumes the other vector is of the same size
    async subtract(otherVector) {
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
            size: [this.dimension, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const subtractBindGroup = device.createBindGroup({
            label: "matrix addition bind group",
            layout: subtractPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.texture.createView() },
                { binding: 1, resource: otherVector.texture.createView() },
                { binding: 2, resource: resultTexture.createView() }
            ]
        })

        const subtractEncoder = device.createCommandEncoder()
        const subtractPass = subtractEncoder.beginComputePass()
        subtractPass.setPipeline(subtractPipeline)
        subtractPass.setBindGroup(0, subtractBindGroup)
        subtractPass.dispatchWorkgroups(this.dimension, 1, 1)
        subtractPass.end()

        const subtractCommandBuffer = subtractEncoder.finish()
        device.queue.submit([subtractCommandBuffer])

        return new Vector(this.dimension, resultTexture)
    }

    async multiplyScalar(scalar) {
        const mModule = device.createShaderModule({
            label: "vector multiply scalar module",
            code: (await loadWGSL("./shaders/multiplyScalar.wgsl")).replace("_SCALAR", scalar)
        })

        const msPipeline = device.createComputePipeline({
            label: "vector multiply scalar pipeline",
            layout: "auto",
            compute: {
                module: mModule
            }
        })

        const resultTexture = device.createTexture({
            dimension: "2d",
            size: [this.dimension, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const mBindGroup = device.createBindGroup({
            label: "vector multiply scalar bind group",
            layout: msPipeline.getBindGroupLayout(0),
            entries: [
                {binding: 0, resource: this.texture.createView()},
                {binding: 1, resource: resultTexture.createView()}
            ]
        })

        const mEncoder = device.createCommandEncoder()
        const mPass = mEncoder.beginComputePass()
        mPass.setPipeline(msPipeline)
        mPass.setBindGroup(0, mBindGroup)
        mPass.dispatchWorkgroups(this.dimension, 1, 1)
        mPass.end()

        device.queue.submit([mEncoder.finish()])

        return new Vector(this.dimension, resultTexture)
    }
}

class ComplexVector {
    constructor(dimension, realTexture, imaginaryTexture, hasReal, hasImaginary) {
        this.dimension = dimension

        this.real = new Vector(dimension, realTexture)
        this.imaginary = new Vector(dimension, imaginaryTexture)

        this.hasReal = hasReal !== undefined ? hasReal : true
        this.hasImaginary = hasImaginary !== undefined ? hasImaginary : true
    }

    async calculateModSquare(){
        const msModule = device.createShaderModule({
            label: "modulus square module",
            code: await loadWGSL("./shaders/modSquare.wgsl")
        })

        const msPipeline = device.createComputePipeline({
            label: "modulus square pipeline",
            layout: "auto",
            compute: {
                module: msModule
            }
        })

        this.modSquareTexture = device.createTexture({
            dimension: "2d",
            size: [this.dimension, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

        const msBindGroup = device.createBindGroup({
            label: "modulus square bind group",
            layout: msPipeline.getBindGroupLayout(0),
            entries: [
                {binding: 0, resource: this.real.texture.createView()},
                {binding: 1, resource: this.imaginary.texture.createView()},
                {binding: 2, resource: this.modSquareTexture.createView()}
            ]
        })

        const msEncoder = device.createCommandEncoder()
        const msPass = msEncoder.beginComputePass()
        msPass.setPipeline(msPipeline)
        msPass.setBindGroup(0, msBindGroup)
        msPass.dispatchWorkgroups(this.dimension, 1, 1)
        msPass.end()

        device.queue.submit([msEncoder.finish()])

        return this.modSquareTexture
    }

    async getModSquare() {
        if (!this.modSquare) {this.modSquare = new Array(this.dimension).fill(0)}

        const unpaddedBytesPerTexHorizontal = this.dimension * 4
        const paddedBytesPerTexHorizontal = Math.ceil(unpaddedBytesPerTexHorizontal / 256) * 256
        const bufferSize = paddedBytesPerTexHorizontal * 1

        const readBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })

        const readEncoder = device.createCommandEncoder()
        readEncoder.copyTextureToBuffer(
            {texture: this.modSquareTexture},
            {
                buffer: readBuffer,
                bytesPerRow: paddedBytesPerTexHorizontal,
                rowsPerImage: 1
            },
            [this.dimension, 1, 1]
        )

        device.queue.submit([readEncoder.finish()])

        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readBuffer.getMappedRange();
        const data = new Float32Array(mappedRange);

        for (let i = 0; i < this.dimension; i++) {
            this.modSquare[i] = data[i]
        }

        return this.modSquare
    }
}