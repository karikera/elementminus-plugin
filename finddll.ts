
import path = require('path');
import { dll } from 'bdsx/dll';
import { MAX_PATH } from 'bdsx/windows_h';
import { fsutil } from 'bdsx/fsutil';
import { makefunc } from 'bdsx/makefunc';
import { int32_t } from 'bdsx/nativetype';

const GetDllDirectoryW = dll.kernel32.module.getFunction('GetDllDirectoryW', int32_t, null, int32_t, makefunc.Buffer);
const GetSystemDirectoryW = dll.kernel32.module.getFunction('GetSystemDirectoryW', int32_t, null, makefunc.Buffer, int32_t);
const GetWindowsDirectoryW = dll.kernel32.module.getFunction('GetWindowsDirectoryW', int32_t, null, makefunc.Buffer, int32_t);

function winapiToString(fn:(buffer:Uint8Array, cap:number)=>number):string{
    const buf = Buffer.alloc(MAX_PATH);
    const size = fn(buf, MAX_PATH);
    return buf.slice(0, size).toString('utf16le');
}

function winapiToString2(fn:(cap:number, buffer:Uint8Array)=>number):string{
    const buf = Buffer.alloc(MAX_PATH);
    const size = fn(MAX_PATH, buf);
    return buf.slice(0, size).toString('utf16le');
}


export function findDll(filename:string):string|null {
    // search exe path
    {
        const exePath = process.argv[0];
        const dllpath = path.join(path.dirname(exePath), filename);
        if (fsutil.isFileSync(dllpath)) return dllpath;
    }

    // search dll path
    {
        const dlldir = winapiToString2(GetDllDirectoryW);
        const dllpath = path.join(dlldir, filename);
        if (fsutil.isFileSync(dllpath)) return dllpath;
    }

    // search system directory
    {
        const systemdir = winapiToString(GetSystemDirectoryW);
        const dllpath = path.join(systemdir, filename);
        if (fsutil.isFileSync(dllpath)) return dllpath;
    }

    // search windows directory
    {
        const windir = winapiToString(GetWindowsDirectoryW);
        const dllpath = path.join(windir, filename);
        if (fsutil.isFileSync(dllpath)) return dllpath;
    }

    // search pathes
    {
        const pathes = process.env.PATH || '';
        for (const dirname of pathes.split(';')) {
            const dllpath = path.join(dirname, filename);
            if (fsutil.isFileSync(dllpath)) return dllpath;
        }
    }
    return null;
}
