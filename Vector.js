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
}