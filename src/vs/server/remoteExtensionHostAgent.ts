/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vs/base/common/uri';
import { run as runCli, shouldSpawnCli } from 'vs/server/remoteExtensionManagement';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { RemoteExtensionHostAgentServer } from 'vs/server/remoteExtensionHostAgentServer';
import { getLogLevel, ILogService } from 'vs/platform/log/common/log';
import { RemoteExtensionLogFileName } from 'vs/workbench/services/remote/common/remoteAgentService';
import { SpdLogService } from 'vs/platform/log/node/spdlogService';
import { generateUuid } from 'vs/base/common/uuid';
import { parseArgs, OPTIONS, OptionDescriptions, ErrorReporter } from 'vs/platform/environment/node/argv';
import { join, dirname } from 'vs/base/common/path';

const serverOptions: OptionDescriptions<ServerParsedArgs> = {
	'port': { type: 'string' },
	'connectionToken': { type: 'string' },
	'host': { type: 'string' },
	'socket-path': { type: 'string' },
	'driver': { type: 'string' },

	'fileWatcherPolling': { type: 'string' },

	'enable-remote-auto-shutdown': { type: 'boolean' },
	'remote-auto-shutdown-without-delay': { type: 'boolean' },

	'disable-telemetry': OPTIONS['disable-telemetry'],

	'extensions-dir': OPTIONS['extensions-dir'],
	'extensions-download-dir': OPTIONS['extensions-download-dir'],
	'install-extension': OPTIONS['install-extension'],
	'uninstall-extension': OPTIONS['uninstall-extension'],
	'locate-extension': OPTIONS['locate-extension'],
	'list-extensions': OPTIONS['list-extensions'],
	'force': OPTIONS['force'],
	'do-not-sync': OPTIONS['do-not-sync'],

	'disable-user-env-probe': OPTIONS['disable-user-env-probe'],

	'folder': { type: 'string' },
	'workspace': { type: 'string' },
	'web-user-data-dir': { type: 'string' },
	'use-host-proxy': { type: 'string' },

	_: OPTIONS['_']
};

export interface ServerParsedArgs {
	port?: string;
	connectionToken?: string;
	host?: string;
	'socket-path'?: string;
	driver?: string;
	'disable-telemetry'?: boolean;
	fileWatcherPolling?: string;

	'enable-remote-auto-shutdown'?: boolean;
	'remote-auto-shutdown-without-delay'?: boolean;

	'extensions-dir'?: string;
	'extensions-download-dir'?: string;
	'install-extension'?: string[];
	'uninstall-extension'?: string[];
	'list-extensions'?: boolean;
	'locate-extension'?: string[];

	'disable-user-env-probe'?: boolean;
	'use-host-proxy'?: string;

	force?: boolean; // used by install-extension
	'do-not-sync'?: boolean; // used by install-extension

	'user-data-dir'?: string;
	'builtin-extensions-dir'?: string;

	// web
	workspace: string;
	folder: string;
	'web-user-data-dir'?: string;

	_: string[];
}

export class ServerEnvironmentService extends EnvironmentService {
	get args(): ServerParsedArgs { return super.args as ServerParsedArgs; }
}

const errorReporter: ErrorReporter = {
	onMultipleValues: (id: string, usedValue: string) => {
		console.error(`Option ${id} can only be defined once. Using value ${usedValue}.`);
	},

	onUnknownOption: (id: string) => {
		console.error(`Ignoring option ${id}: not supported for server.`);
	}
};

const args = parseArgs(process.argv.slice(2), serverOptions, errorReporter);

const REMOTE_DATA_FOLDER = process.env['VSCODE_AGENT_FOLDER'] || join(os.homedir(), '.vscode-remote');
const USER_DATA_PATH = join(REMOTE_DATA_FOLDER, 'data');
const APP_SETTINGS_HOME = join(USER_DATA_PATH, 'User');
const GLOBAL_STORAGE_HOME = join(APP_SETTINGS_HOME, 'globalStorage');
const MACHINE_SETTINGS_HOME = join(USER_DATA_PATH, 'Machine');
args['user-data-dir'] = USER_DATA_PATH;
const APP_ROOT = dirname(URI.parse(require.toUrl('')).fsPath);
const BUILTIN_EXTENSIONS_FOLDER_PATH = join(APP_ROOT, 'extensions');
args['builtin-extensions-dir'] = BUILTIN_EXTENSIONS_FOLDER_PATH;
const CONNECTION_AUTH_TOKEN = args['connectionToken'] || generateUuid();
const HOST = args.host;

let PORT: number = 8000;
try {
	if (args.port) {
		PORT = parseInt(args.port);
	}
} catch (e) {
	console.log('Port is not a number, using 8000 instead.');
}

const SOCKET_PATH = args['socket-path'];

args['extensions-dir'] = args['extensions-dir'] || join(REMOTE_DATA_FOLDER, 'extensions');

[REMOTE_DATA_FOLDER, args['extensions-dir'], USER_DATA_PATH, APP_SETTINGS_HOME, MACHINE_SETTINGS_HOME, GLOBAL_STORAGE_HOME].forEach(f => {
	try {
		if (!fs.existsSync(f)) {
			fs.mkdirSync(f);
		}
	} catch (err) { console.error(err); }
});

const environmentService = new ServerEnvironmentService(args);
const logService: ILogService = new SpdLogService(RemoteExtensionLogFileName, environmentService.logsPath, getLogLevel(environmentService));
logService.trace(`Remote configuration data at ${REMOTE_DATA_FOLDER}`);
logService.trace('process arguments:', args);

function eventuallyExit(code: number): void {
	setTimeout(() => process.exit(code), 0);
}

if (shouldSpawnCli(args)) {
	runCli(args, environmentService, logService)
		.then(() => eventuallyExit(0))
		.then(null, err => {
			logService.error(err.message || err.stack || err);
			eventuallyExit(1);
		});
} else {
	const license = `

*
* Azure Data Studio Server
*
* Reminder: You may only use this software with Visual Studio family products,
* as described in the license https://aka.ms/vscode-remote/license
*

`;
	logService.info(license);
	console.log(license);

	//
	// On Windows, exit early with warning message to users about potential security issue
	// if there is node_modules folder under home drive or Users folder.
	//
	if (process.platform === 'win32' && process.env.HOMEDRIVE && process.env.HOMEPATH) {
		const homeDirModulesPath = path.join(process.env.HOMEDRIVE, 'node_modules');
		const userDir = path.dirname(path.join(process.env.HOMEDRIVE, process.env.HOMEPATH));
		const userDirModulesPath = path.join(userDir, 'node_modules');
		if (fs.existsSync(homeDirModulesPath) || fs.existsSync(userDirModulesPath)) {
			const message = `

*
* !!!! Server terminated due to presence of CVE-2020-1416 !!!!
*
* Please remove the following directories and re-try
* ${homeDirModulesPath}
* ${userDirModulesPath}
*
* For more information on the vulnerability https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-1416
*

`;
			logService.warn(message);
			console.warn(message);
			process.exit(0);
		}
	}

	const server = new RemoteExtensionHostAgentServer(CONNECTION_AUTH_TOKEN, environmentService, logService);
	if (SOCKET_PATH) {
		server.start({ socketPath: SOCKET_PATH });
	} else {
		server.start({ host: HOST, port: PORT });
	}
	process.on('exit', () => {
		server.dispose();
	});
}
