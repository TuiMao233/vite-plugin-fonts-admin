"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fontAdminMiddlewares = void 0;
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const json_server_1 = __importDefault(require("json-server"));
const path_1 = __importDefault(require("path"));
const svgtofont_1 = __importDefault(require("svgtofont"));
const archiver_1 = __importDefault(require("archiver"));
const utils_1 = require("./utils");
const common_1 = require("@tuimao/utils/package/common");
const multer_1 = __importDefault(require("multer"));
const nanoid_1 = require("nanoid");
const utils = require('nodejs-fs-utils');
const createTTFBase64FontFace = (base64) => {
    return `@font-face { font-family: "iconfont"; src: url('data:font/woff2;charset=utf-8;base64,${base64}') format('truetype'); }`;
};
const fontAdminMiddlewares = (option = {}) => {
    const targetPath = option.path || 'fontsdb';
    const optionPath = `${targetPath}/index.json`;
    const app = express_1.default();
    // 判断路径是否存在 / 符合创建环境
    if (!fs_1.default.existsSync(optionPath)) {
        utils.mkdirsSync(targetPath);
        fs_1.default.writeFileSync(optionPath, '{}', { flag: 'w' });
    }
    const jsonRouter = json_server_1.default.router(optionPath);
    jsonRouter.db.defaults({ group: [], fonts: [] }).write();
    // 配置静态资源访问
    app.use('/fonts', express_1.default.static(path_1.default.resolve(__dirname, 'public')));
    // 配置 josn-server 服务
    app.use('/json', jsonRouter);
    // 生成所有配置
    const generateFonts = async (defaultOption = {}) => {
        const { target = targetPath, base64, css, groups, classNamePrefix, outTarget } = Object.assign(Object.assign({}, option), defaultOption);
        const generateTarget = path_1.default.join(target, '/fonts');
        // Get fonts
        const allFonts = jsonRouter.db.get('fonts').value();
        const fonts = allFonts.filter((f) => {
            return typeof groups === 'undefined' || groups.some((v) => v == f.group);
        });
        if (!fonts.length)
            return Promise.reject();
        // Generate Fonts
        await utils_1.generateSvgCahes(fonts);
        await svgtofont_1.default({
            src: path_1.default.resolve(__dirname, './caches'),
            dist: generateTarget,
            classNamePrefix,
            css: typeof css === 'undefined' || css
        });
        // Generate Types
        const typeKeys = fonts
            .map((v) => `'${v.key}'`)
            .join(' | ')
            .trim();
        fs_1.default.writeFileSync(path_1.default.resolve(generateTarget, 'iconfont.key.ts'), `export type IconfontKey = ${typeKeys || 'string'}`);
        // Generate Json
        const json = fonts.reduce((total, value) => {
            total[value.key] = value.value;
            return total;
        }, {});
        fs_1.default.writeFileSync(path_1.default.resolve(generateTarget, 'iconfont.json'), JSON.stringify(json, null, '\t'));
        // Generate Base64
        if (base64) {
            const ttfBase64 = fs_1.default.readFileSync(path_1.default.resolve(generateTarget, 'iconfont.ttf'), 'base64');
            const cssFile = fs_1.default.readFileSync(path_1.default.resolve(generateTarget, 'iconfont.css'), 'utf-8');
            const base64Css = cssFile.replace(/@font-face \{([\s\S]*)\*\/\n\}/, createTTFBase64FontFace(ttfBase64));
            fs_1.default.writeFileSync(path_1.default.resolve(generateTarget, 'iconfont.base64.css'), base64Css);
        }
        // Generate Zip
        if (outTarget) {
            utils.mkdirsSync(outTarget);
            const zipPath = path_1.default.resolve(outTarget, './iconfont.zip');
            const output = fs_1.default.createWriteStream(zipPath);
            const archive = archiver_1.default('zip', {
                zlib: { level: 9 }
            });
            utils_1.archiverLogger(output, archive);
            archive.directory(target, false);
            archive.pipe(output);
            await archive.finalize();
            return new Promise((r) => output.on('close', () => r(zipPath)));
        }
    };
    // 导出 Fonts
    app.get('/out-fonts', async (req, res) => {
        const groups = req.query.ids;
        const classNamePrefix = req.query.prefix;
        try {
            const zipPath = await generateFonts({
                groups,
                classNamePrefix,
                outTarget: path_1.default.resolve(__dirname, 'compress'),
                css: true,
                base64: true
            });
            res.sendFile(zipPath);
        }
        catch (error) {
            res.status(500).send(error);
        }
    });
    // 配置上传, 导入多个 svg
    const svgUpload = multer_1.default({
        fileFilter: (req, file, callback) => {
            const ext = path_1.default.extname(file.originalname);
            callback(null, ext === '.svg');
        }
    });
    // 上传 svg
    app.post('/upload-svgs', svgUpload.array('files', 20), async (req, res) => {
        const files = req.files;
        const group = JSON.parse(req.body.group);
        const isRetainColor = JSON.parse(req.body.isRetainColor);
        files
            .map((v) => ({
            id: nanoid_1.nanoid(10),
            key: v.originalname.split('.')[0],
            value: v.buffer.toString(),
            group
        }))
            .map((v) => {
            if (!isRetainColor) {
                v.value = common_1.setHtmlStrTagAttr({
                    html: v.value, tag: 'path',
                    attr: 'fill', value: 'currentColor'
                });
                v.value = common_1.setHtmlStrTagAttr({
                    html: v.value, tag: 'svg',
                    attr: 'fill', value: 'currentColor'
                });
            }
            return v;
        })
            .reduce((total, value) => total.push(value), jsonRouter.db.get('fonts'))
            .write();
        res.send('导出成功!');
    });
    app.font = {
        generateFonts,
        targetPath,
        optionPath
    };
    return app;
};
exports.fontAdminMiddlewares = fontAdminMiddlewares;
//# sourceMappingURL=middlewares.js.map