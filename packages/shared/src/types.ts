export type User = {
    id: string;
    username: string;
    email: string;
};

export enum Role {
    PRESIDENT = 'PRESIDENT',
    VICE_PRESIDENT = 'VICE_PRESIDENT',
    NEUTRE = 'NEUTRE',
    VICE_TDC = 'VICE_TDC',
    TDC = 'TDC',
}
