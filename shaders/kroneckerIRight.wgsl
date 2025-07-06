@group(0) @binding(0) var<storage, read> oldEntries: array<u32>;
@group(0) @binding(1) var<storage, read_write> newEntries: array<u32>;

const ISize = _ISIZE;
const oldSize = _OLDSIZE;
const workgroupsPerDimension = _WORKGROUPSPERDIM;

@compute @workgroup_size(1)fn kroneckerILeft(
    @builtin(global_invocation_id) id: vec3u
) {
    let newRow = id.x * workgroupsPerDimension + id.y;

    if newRow < oldSize * ISize { //else, it's out of bounds (which may happen)
        let oldRow = u32(f32(newRow) / f32(ISize));

        let oldVal = oldEntries[oldRow];

        // for each value, the first bit stores if the value of the entry is 1, the second stores its row if not (both of these make up the two bits "data"), and the rest store which column the value is at
        let data = oldVal >> 30;
        let oldColumnIndex: u32 = oldVal & 0x3FFFFFFF;

        let newColumnIndex = (newRow % ISize + oldColumnIndex * ISize) & 0x3FFFFFFF;
                                                                      // ensures it's only 30 bits, but this shouldnt happen until more than 30 qbits

        // now we're repacking "data", but with the new index
        let newVal = (data << 30) | newColumnIndex;

        newEntries[newRow] = newVal;
    }
}