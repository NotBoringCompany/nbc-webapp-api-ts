import { randomBytes } from 'crypto'

/**
 * `randomString` generates a random string of a given `size`.
 * @param size the size of the string to generate.
 * @returns the generated string
 */
export const randomString = (size: number): string => {
    if (size === 0) {
        throw new Error('String size cannot be 0.')
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789'
    let str = ''
    const bytes = randomBytes(size)

    for (let i = 0; i < bytes.length; i++) {
        str += chars[bytes.readUInt8(i) % chars.length]
    }

    return str
}

/**
 * `generateObjectId` is an alternative object ID for all MongoDB documents.
 * This is used to be compatible with Parse Platform's way of storing documents in MongoDB so it can be read from their dashboard.
 * @returns the generated object ID
 */
export const generateObjectId = (): string => {
    return randomString(10)
}
