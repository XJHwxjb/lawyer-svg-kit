# 人物与动作总表（选角查这一份）

> 新造人物/动作后必须回写本表。id 即代码键名，预览台 `__kit.setAction(id)` / `__kit.setPortrait(who, variant)` 可直接调用。
> 全库人物与动作均支持双画幅：`__kit.setOrientation('land')` 横屏 16:9 / `('port')` 竖屏 9:16，坐标自动重排（契约见 studio.md §8）；按项目单选其一生成。

## 1. 人物库 · 16 基础剪影 + 14 变体

六组：`party 当事人` / `court 司法·执法` / `agent 代理·调解` / `biz 商事` / `life 民生` / `other 对抗·其他`。
`hand` 为接物锚点（局部坐标，脚底原点）；`face` 为天然朝向（woman = -1，其余 1）。

| id | 名称 | 组 | 身份识别三件套 | hand | 变体（id → 含义） |
|---|---|---|---|---|---|
| man | 男方 | party | 蓝衫短发（通用男性当事人） | [80,-158] | patient→患者(绷带臂) · landlord→房东(钥匙) |
| woman | 女方 | party | 红裙发髻（通用女性当事人） | [-80,-158] | third→第三者(紫裙) · tenant→租客(行李箱) |
| child | 小孩 | party | 小一号+书包 | [55,-105] | — |
| parent | 父母 | party | 驼背+拐杖+灰发+存折 | [80,-158] | matchmaker→媒婆(红花+绛衣) |
| judge | 法官 | court | 黑袍红襟+金徽+法槌 | [80,-158] | — |
| prosecutor | 检察官 | court | 制服+起诉书 | [80,-158] | — |
| clerk | 书记员 | court | 灰制服+发髻+记录本 | [80,-158] | notary→公证员(深蓝制服+公证书) |
| police | 警察 | court | 大檐帽+手铐 | [80,-158] | traffic→交警(白帽) · bailiff→法警(黑制服) |
| lawyer | 律师 | agent | 西装红领带+法典 | [80,-158] | — |
| mediator | 调解员 | agent | 工作服+文件夹 | [80,-158] | — |
| boss | 老板 | biz | 深灰西装金领带+公章+公文包 | [80,-158] | hr→HR(文件夹) · investor→投资人(钱袋) · partner→合伙人(棕西装) |
| accountant | 会计 | biz | 马甲+账本 | [80,-158] | — |
| worker | 工人 | life | 金安全帽+工装反光条 | [80,-158] | rider→骑手(保温箱) · injured→工伤者(绷带) · property→物业(扳手+绿工装) |
| doctor | 医生 | life | 白大褂+听诊器+病历夹 | [80,-158] | — |
| rogue | 老赖 | other | 鸭舌帽+帽衫+背后钱袋 | [80,-158] | — |
| witness | 证人 | other | 举手姿势即身份 | [55,-266] | — |

变体只改 `opt`（颜色/道具/姿态开关），不新建 draw 函数；需要新轮廓才造新人物。

## 2. 动作库 · 36 动作

机制列 = 所用工厂（见 action-forge.md）。cast 列省略 `opt:{noProp:true}` 标注规则：飞行道具给出方一律 noProp。

### 原有 8 动作（彩礼案基线，cast 默认 man+woman）
| id | 名称 | 类 | 机制 | 说明 |
|---|---|---|---|---|
| doc-handoff | 文书递接 | hand | 自定义 | 起诉状弧线飞出，接住翻面 |
| cert-join-split | 结婚证合·裂 | hand | 自定义 | 合拢脉冲→裂缝闪白→分飞 |
| money-flow | 钞票流·计数 | money | 自定义 | 10 张落堆 + count-up |
| stack-split | 钱堆分裂 | money | 自定义 | 总堆分裂返还/留存 |
| approach-retreat | 靠近·退后 | move | 自定义 | 对峙怒标→僵持→复位 |
| breakup-crack | 分手·裂缝 | move | 自定义 | 裂缝生长→闪白→灰化碎心 |
| stamp-drop | 印章砸落 | focus | 自定义 | 冲击波+认定印 |
| signature | 执笔签字 | focus | 自定义 | 笔沿签名路径描边+确认章 |

### 新增 28 招牌动作
| id | 名称 | 类 | 机制 | cast |
|---|---|---|---|---|
| gavel-drop | 敲槌定音 | focus | actStamp(gavel) | judge + woman |
| verdict-handoff | 递判决书 | hand | actHandoff | judge + man |
| arrest | 上铐抓捕 | lock | actLock | police + rogue |
| escort | 带离现场 | move | actMovePair(grayB) | police + rogue |
| law-reveal | 亮法条 | focus | actFocus(book) | lawyer + man |
| retainer-handoff | 递委托手续 | hand | actHandoff(folder) | lawyer + man |
| asset-hide | 转移财产 | money | actMoney(chip,sneak) | rogue |
| limit-gray | 限高灰化 | move | actGray | rogue |
| mediation-handoff | 递调解协议 | hand | actHandoff | mediator + woman |
| handshake | 促成握手 | lock | actJoint(shake) | man + woman + mediator(居中) |
| oath | 宣誓保证 | focus | actFocus(chip) | witness |
| testimony-handoff | 递证言 | hand | actHandoff | witness + judge |
| savings-flow | 递积蓄 | money | actMoney(pile) | parent + man |
| support-exit | 搀扶离场 | move | actMovePair | parent + man |
| indict-handoff | 提起公诉 | hand | actHandoff(indict) | prosecutor + judge |
| indict-read | 宣读起诉书 | focus | actFocus(doc+lines) | prosecutor + judge |
| record-focus | 庭审记录 | focus | actFocus(ledger) | clerk + judge |
| record-handoff | 递笔录 | hand | actHandoff(record) | clerk + man |
| contract-seal | 盖章签约 | focus | actStamp(seal) | boss + worker |
| seal-grab | 抢公章 | lock | actJoint(seal) | boss + boss(partner) |
| wages-flow | 讨薪·计数 | money | actMoney(pile) | boss + worker |
| injury-focus | 工伤认定 | focus | actFocus(chip) | worker(injured) + boss |
| chart-handoff | 递病历 | hand | actHandoff(chart) | doctor + man(patient) |
| appraisal-focus | 医疗鉴定 | focus | actFocus(doc+lines) | doctor + man(patient) |
| audit-focus | 对账 | focus | actFocus(ledger) | accountant + boss |
| embezzle-expose | 转移资产曝光 | money | actMoney(chip,sneak,extra) | accountant + boss |
| custody-move | 抚养权归属 | move | actCustody | man + woman + child |
| alimony-flow | 抚养费·计数 | money | actMoney(pile,extra) | man + woman + child |

## 3. 业务领域 → 推荐组合矩阵

| 领域 | 推荐 cast | 推荐动作链 |
|---|---|---|
| 婚姻家事·彩礼 | man + woman + parent | savings-flow → cert-join-split → stack-split → breakup-crack |
| 婚姻家事·离婚抚养 | man + woman + child | breakup-crack → custody-move → alimony-flow |
| 继承 | parent + man + woman(+clerk/notary) | savings-flow → record-focus → verdict-handoff |
| 劳动·讨薪工伤 | worker(+injured) + boss(+hr) | wages-flow → contract-seal → injury-focus → arrest(恶意欠薪移送) |
| 公司·股权公章 | boss + boss(partner) + accountant | seal-grab → audit-focus → embezzle-expose → verdict-handoff |
| 合同·债务 | man + woman + rogue | doc-handoff → money-flow → asset-hide → limit-gray → arrest |
| 房产·物业 | man(landlord) + woman(tenant) + worker(property) | retainer-handoff → mediation-handoff → handshake |
| 交通 | police(traffic) + man + woman | approach-retreat → record-focus → verdict-handoff |
| 医疗 | doctor + man(patient) | chart-handoff → appraisal-focus → mediation-handoff |
| 消费·知产 | man + boss + lawyer | law-reveal → retainer-handoff → contract-seal → gavel-drop |
| 刑事 | police + prosecutor + judge + rogue | arrest → escort → indict-handoff → indict-read → gavel-drop |
| 行政 | police(bailiff) + man + clerk | record-handoff → law-reveal → gavel-drop |

矩阵是起点不是限制：任何组合都可用工厂现拼（例如"法官递调解书"= actHandoff from judge prop doc）。

## 4. 缺口登记（已想过但尚未造）

以下角色/动作在需求讨论中出现过、当前库未覆盖；遇到时按 forge 教程现造并回写本表：
- 角色：消防员/税务员/城管/银行柜员/评估师/拍卖师/狱警/法医/知识产权审查员/涉外翻译。
- 动作：查封贴封条、拍卖落槌、冻结账户、送达公告、探望权交接、遗嘱开读。