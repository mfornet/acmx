import * as unescape from 'unescape';

export function getText(htmlNode: any){
    let data: string[] = [];

    htmlNode.contents.forEach((element: any) => {
        if (element._text === undefined){
            data.push('\n');
        }
        else{
            if (data.length === 0 && element._text[0] === '\n'){
                data.push(element._text.slice(1));
            }
            else{
                data.push(element._text);
            }
        }
    });

    let pData = data.join();

    return unescape(pData, undefined);
}