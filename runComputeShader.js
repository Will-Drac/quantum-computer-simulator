// makes running a pass of a wgsl shader less to type
function runComputeShader(code, bindGroupEntries, workgroupsDimensions) {

    const module = device.createShaderModule({ code })

    const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module }
    })

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries
    })

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(workgroupsDimensions[0], workgroupsDimensions[1], workgroupsDimensions[2])
    pass.end()

    device.queue.submit([encoder.finish()])
}