@group(0) @binding(0) var<storage, read> leftVectorReal: array<f32>;
@group(0) @binding(1) var<storage, read> leftVectorImag: array<f32>;

@group(0) @binding(2) var<storage, read> rightVectorReal: array<f32>;
@group(0) @binding(3) var<storage, read> rightVectorImag: array<f32>;

@group(0) @binding(4) var<storage, read_write> newVectorReal: array<f32>;
@group(0) @binding(5) var<storage, read_write> newVectorImag: array<f32>;

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const newSize = _NEWSIZE;

const leftSize = _LEFTSIZE;
const rightSize = _RIGHTSIZE;

@compute @workgroup_size(1) fn kronecker(
    @builtin(global_invocation_id) id: vec3u
) {
    let newIndex = id.x * workgroupsPerDimension + id.y;

    if (newIndex < newSize) {
        let leftIndex = newIndex / rightSize;
        let rightIndex = newIndex % rightSize;

        let leftReal = leftVectorReal[leftIndex];
        let leftImag = leftVectorImag[leftIndex];

        let rightReal = rightVectorReal[rightIndex];
        let rightImag = rightVectorImag[rightIndex];

        newVectorReal[newIndex] = leftReal*rightReal - leftImag*rightImag;
        newVectorImag[newIndex] = leftReal*rightImag + leftImag*rightReal;
    }
}