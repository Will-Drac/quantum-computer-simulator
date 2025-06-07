class Vector {
    constructor(dimension) {
        this.dimension = dimension
        this.entries = new Array(dimension).fill(0)
    }

    getTexture() {
        const texture = device.createTexture({
            dimension: "2d",
            size: [this.dimension, 1, 1],
            format: "r32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        })

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
                texture: texture
            },
            [this.dimension, 1, 1]
        )

        const commandBuffer = commandEncoder.finish()
        device.queue.submit([commandBuffer])

        this.vectorTexture = new VectorTexture(this.dimension, texture)
        return this.vectorTexture
    }
}

class VectorTexture {
    constructor(dimension, texture) {
        this.dimension = dimension
        this.tex = texture
    }

    // turns it into a Vector object, where the entries can be seen and edited
    async getVector() {
        let V = new Vector(this.dimension)

        const unpaddedBytesPerTexHorizontal = this.dimension * 4
        const paddedBytesPerTexHorizontal = Math.ceil(unpaddedBytesPerTexHorizontal / 256) * 256
        const bufferSize = paddedBytesPerTexHorizontal * 1

        const readBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })

        const readEncoder = device.createCommandEncoder()
        readEncoder.copyTextureToBuffer(
            {texture: this.tex},
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
            V.entries[i] = data[i]
        }

        V.vectorTexture = this // so that work doesnt need to be done to get back to the MatrixTexture "this"

        return V
    }
}