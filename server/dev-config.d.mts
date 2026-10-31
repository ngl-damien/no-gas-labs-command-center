export type CommandCenterEnvironment = Readonly<Record<string, string | undefined>>;

export function commandCenterPort(env?: CommandCenterEnvironment): number;
export function commandCenterUiPort(env?: CommandCenterEnvironment): number;
export function commandCenterApiHost(env?: CommandCenterEnvironment): string;
export function commandCenterUiHost(env?: CommandCenterEnvironment): string;
export function commandCenterApiTarget(env?: CommandCenterEnvironment): string;
