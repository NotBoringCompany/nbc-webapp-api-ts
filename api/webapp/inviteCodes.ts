import { ReturnValue, Status } from '../../utils/retVal';

/**
 * `generateInviteCodes` generates invite codes for a specific `purpose` (such as for Alpha V1 (the game), or for other purposes).
 * @param purpose the purpose of the invite codes
 * @param adminPassword the admin password to generate the invite codes
 * @returns a ReturnValue instance
 */
export const generateInviteCodes = async (purpose: string, adminPassword: string): Promise<ReturnValue> => {
    try {

    } catch (err: any) {
        console.log({
            status: Status.ERROR,
            message: err,
            data: null
        })
        
        return {
            status: Status.ERROR,
            message: err,
            
        }
    }
}