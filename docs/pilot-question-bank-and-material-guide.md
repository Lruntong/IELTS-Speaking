# 首批测试题库与素材引导清单

## 用途与边界

这份规格用于首批 30–50 道 IELTS Speaking Part 2 测试题的人工导入，以及素材采访流程的实现。题目应记录来源、收录日期和可信度；不要将任何商业备考产品的题目直接标记为“官方真题”。

首批测试只验证三件事：一条真实素材能否匹配多题、匹配解释是否可信、用户是否能用自己的细节完成 1–2 分钟表达。

## 题库 CSV 格式

文件编码使用 UTF-8；一行代表一道题；`cue_points` 使用 `|` 分隔；`tags` 使用 `,` 分隔。

```csv
question_id,season,status,prompt,cue_points,tags,required_slots,source_type,source_name,source_url,reported_at,confidence,notes
P2-2026-09-001,2026-09,current,"Describe a memorable outdoor activity.","what it was|when and where you did it|who you were with|why it was memorable","outdoors,activity,experience","time,place,participants,activity,turning_point,feeling","editorial","首批人工测试题库","",2026-08-16,reviewed,""
P2-2026-09-002,2026-09,current,"Describe a person who has helped you.","who the person is|how you know this person|what they did for you|how you felt","person,relationship,help","person,relationship,concrete_help,event,feeling","community_report","待填写来源","",2026-08-16,unverified,"需编辑审核"
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `question_id` | 是 | 稳定且不可复用，例如 `P2-2026-09-001`。 |
| `season` | 是 | 题库版本，例如 `2026-09`；旧版本不删除，只归档。 |
| `status` | 是 | `current`、`archived`、`draft`。 |
| `prompt` | 是 | 完整英文题干。 |
| `cue_points` | 否 | Cue card 的要点，使用 `|` 分隔。 |
| `tags` | 是 | 主题标签，便于初筛。 |
| `required_slots` | 是 | 回答这道题需要的事实槽位，用于素材匹配。 |
| `source_type` | 是 | `official_sample`、`editorial`、`community_report` 三选一。 |
| `source_name` / `source_url` | 是 | 来源与链接；无链接时说明收录方式。 |
| `reported_at` | 是 | 收录日期，格式 `YYYY-MM-DD`。 |
| `confidence` | 是 | `official`、`reviewed`、`unverified`。 |
| `notes` | 否 | 编辑备注、重复题说明或审核结论。 |

## 首批题目配额

建议导入 40 题，而不是一次导入整季题库：

| 题目簇 | 数量 | 常用素材类型 |
|---|---:|---|
| 人物与关系 | 8 | 人物、一次经历 |
| 经历与活动 | 10 | 一次经历、爱好/技能 |
| 地点与旅行 | 7 | 地点、一次经历 |
| 物品、礼物与科技 | 6 | 物品、人物 |
| 学习、成长与爱好 | 6 | 爱好/技能、一次经历 |
| 文化、自然与日常 | 3 | 地点、经历、物品 |

每个题目至少附有 3 个 `required_slots`。不要只按“人物 / 物品 / 地点 / 经历”分类；题目匹配应优先比较事实槽位是否覆盖。

## 五类素材的引导问题

### 1. 一次经历

必问：什么时候发生？在哪里？和谁一起？原来的计划是什么？发生了什么具体转折？最后结果如何？你的感受怎样变化？

可追问：有没有一个能被看见、听见或感受到的小细节？这件事后来如何影响你？

核心槽位：`time`、`place`、`participants`、`plan`、`event`、`turning_point`、`result`、`feeling_before`、`feeling_after`。

### 2. 一个人

必问：他是谁、和你是什么关系？你们怎样认识？他最有特点的习惯或性格是什么？哪件具体事最能代表他？这件事怎样影响你？

可追问：他常说的话、做事方式或一个让人记住的细节是什么？

核心槽位：`identity`、`relationship`、`first_meeting`、`trait`、`concrete_event`、`impact`、`feeling`。

### 3. 一个地点

必问：地点在哪里？你何时、为何第一次去？最有画面感的区域是什么？当时的气味、声音或氛围如何？在那里发生过什么？为什么还想去？

可追问：它和其他地方最大的不同是什么？

核心槽位：`location`、`first_visit`、`reason_to_go`、`scene_detail`、`atmosphere`、`event`、`meaning`。

### 4. 一件物品

必问：它是什么？从哪里得到？什么时候得到？平常如何使用？有什么具体外观或使用细节？它为什么不只是一个物品？

可追问：它是否和某个人、一次经历或某个阶段有关？

核心槽位：`object`、`source`、`time_acquired`、`appearance`、`usage`、`associated_story`、`personal_value`。

### 5. 一个爱好、技能或习惯

必问：它是什么？怎样开始？最初最难的部分是什么？什么时候第一次觉得自己进步了？现在的频率如何？它怎样改变你的生活或心情？

可追问：有没有一位带你入门的人、一次失败或一个小成果？

核心槽位：`activity`、`origin`、`initial_difficulty`、`progress_moment`、`frequency`、`people_involved`、`benefit`。

## 素材匹配等级

- **强匹配**：覆盖题目 80% 以上的必需槽位，且有明确事件或细节。
- **可用**：覆盖主要槽位，但需要补 1–2 个细节。
- **不推荐**：只能匹配主题词，事实结构不足，不应强行套用。

匹配结果必须同时展示理由，例如：“匹配，因为已有时间、地点、同伴和转折；还缺少活动的具体过程。”
