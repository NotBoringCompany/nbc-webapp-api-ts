/**
 * Status enum for `ReturnValue`. Either SUCCESS or ERROR.
 */
export enum Status {
    SUCCESS,
    ERROR
}

/**
 * `ReturnValue` returns a status, message and optionally data.
 */
export interface ReturnValue {
    /** the status (either SUCCESS or ERROR) */
    status: Status
    /** a return message (can be anything, usually to add on to the status) */
    message: string
    /** the data if SUCCESS is returned. usually an object containing required values */
    data?: any
}
