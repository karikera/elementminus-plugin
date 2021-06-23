
import { Encoding } from 'bdsx/common';
import { AllocatedPointer, VoidPointer } from 'bdsx/core';
import { dll, NativeModule } from 'bdsx/dll';
import { fsutil } from 'bdsx/fsutil';
import { int32_t } from 'bdsx/nativetype';
import { ERROR_MOD_NOT_FOUND, FORMAT_MESSAGE_ALLOCATE_BUFFER, FORMAT_MESSAGE_FROM_SYSTEM, LANG_NEUTRAL, MAKELANGID, SUBLANG_DEFAULT } from 'bdsx/windows_h';
import { dllchecker } from './dllchecker';
import fs = require('fs');
import path = require('path');
import colors = require('colors');

const FormatMessageW = dll.kernel32.module.getFunction('FormatMessageW', int32_t, null, int32_t, VoidPointer, int32_t, int32_t, VoidPointer, int32_t, VoidPointer);

function getErrorMessage(errcode:number, args:VoidPointer):string {
    const bufferptr = new AllocatedPointer(8);
    const charlen = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM, null,
        errcode, MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT), bufferptr, 0, args);
    if (charlen === 0) return '?';
    const strptr = bufferptr.getPointer();
    const message = strptr.getString(charlen, 0, Encoding.Utf16);
    dll.kernel32.LocalFree(strptr);
    return message.trim();
}
function printErrorCode(err:number, args:VoidPointer):void {
    console.error(colors.red(`Error Code: ${err}`));
    console.error(colors.red('Error Message: '+getErrorMessage(err, args)));
}

function loadEminus():string|null {
    try {
        return fs.readFileSync('mods/eminus.ini', 'utf-8');
    } catch (err) {
        return null;
    }
}

enum IniSection
{
    Global,
    Module,
}

function eminus_load_dlls_in_mods():void {

    const modules:string[] = [];
    let verbose = true;

    const ini = loadEminus();
    if (ini !== null) {
        let section = IniSection.Global;
        let linenum = 0;

        for (let line of ini.split('\n')) {
            line = line.split('#', 1)[0].trim();
            linenum++;

            if (line === '') {
                // empty
                continue;
            }

            // section
            if (line[0] === '[') {
                let offset = 0;
                offset++;
                let sectionend = line.indexOf(']', offset);
                if (sectionend !== -1) {
                    line = line.substr(0, sectionend);
                    sectionend -= offset;
                } else {
                    sectionend = line.length - offset;
                }
                const sectionName = line.substring(offset, sectionend);

                switch (sectionName) {
                case 'module':
                    section = IniSection.Module;
                    break;
                case 'global':
                    section = IniSection.Global;
                    break;
                default:
                    console.error(`[EMinus] eminus.ini(${linenum}): - unknown section ${line.substr(offset, sectionend)}`);
                    break;
                }
                continue;
            }

            // find equal
            const equal = line.indexOf('=');
            if (equal !== -1) {
                const name = line.substr(0, equal).trimRight();
                const value = line.substr(equal+1).trimLeft();

                switch (section) {
                case IniSection.Global:
                    if (name === 'verbose') {
                        verbose = !!+value;
                        continue;
                    }
                    break;
                }
                console.error(`"[EMinus] eminus.ini(${linenum}): - unknown property ${name}`);
            } else {
                // name only
                switch (section) {
                case IniSection.Module:
                    modules.push(line);
                    break;
                default:
                    console.error(`[EMinus] eminus.ini(${linenum}): - unknown property ${line}`);
                    break;
                }
            }
        }
    } else {
        if (!fsutil.isDirectorySync('mods')) {
            console.error('[EMinus] no mods directory, skip');
            return;
        }
        console.error('[EMinus] no mods\\eminus.ini, It will load mods\\*.dll');
        modules.push(... fs.readdirSync('./mods').filter(x => x.endsWith(".dll")));
    }
    if (verbose) console.log('[EMinus] JS-Version');
    dll.kernel32.SetDllDirectoryW('mods');

    for (const name of modules) {
        if (path.extname(name).toLocaleLowerCase() !== '.dll') continue;
        try {
            NativeModule.get(name);
            if (verbose) console.log(`[EMinus] mods\\${name} (Already loaded)`);
            continue;
        } catch (err) {
        }
        if (verbose) console.log(`[EMinus] mods\\${name}`);
        try {
            NativeModule.load(name);
            continue;
        } catch (err) {
            console.error(`[EMinus] mods\\${name}: ${colors.red('Failed')}`);
            if (err.errno) {
                const bytelen = name.length*2;
                const ptr = new AllocatedPointer(0x10 + bytelen+2);
                ptr.setString(name, 0x10, Encoding.Utf16);
                ptr.setInt16(0, bytelen+0x10);
                ptr.setPointer(ptr.add(0x10), 0x8);
                ptr.setPointer(ptr.add(0x8), 0x0);
                printErrorCode(err.errno, ptr);
                if (err.errno === ERROR_MOD_NOT_FOUND) {
                    dllchecker.check(name);
                }
                process.exit(ERROR_MOD_NOT_FOUND);
            } else {
                throw err;
            }
        }
    }
}

eminus_load_dlls_in_mods();
