import Moralis from "moralis-v1/node";

const getMoralisUser = async (email: string): Promise<Moralis.Object<Moralis.Attributes> | null> => {
    const users = Moralis.Object.extend("_User");
    const userQuery = new Moralis.Query(users);
    userQuery.equalTo("email", email.toLowerCase());
    const queryResult = await userQuery.first({ useMasterKey: true });
    if (queryResult) return JSON.parse(JSON.stringify(queryResult));
    return null;
};

export { getMoralisUser };