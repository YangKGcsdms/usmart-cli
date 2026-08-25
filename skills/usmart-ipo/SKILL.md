---
name: usmart-ipo
version: 2.0.0
description: "uSMART 新股 IPO 认购：查看认购中/待上市新股列表与详情、现金或融资认购、改单、撤单、查询我的申购记录与中签结果、额度不足时确认现金认购数量。当用户要打新股、看新股列表、查申购结果或中签情况时触发。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart ipo --help"
---

# usmart ipo —— 新股认购

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)。

## 看新股

```bash
usmart ipo list --status 0            # 0=认购中 1=待上市
usmart ipo info --ipo-id 2091691841480200192
usmart ipo info --stock-code 09615 --exchange-type 0
```

`list` 返回 `data.list[]`，每条含 `ipoId`（认购要用）、`stockCode`、`stockName`、`status`/`statusName`、
`leastAmount` 最小认购数量、认购截止时间等。新股状态见 `usmart dict get ipo-status`。

## 认购

```bash
usmart ipo apply --ipo-id <id> --apply-type 1 --quantity 100 --dry-run     # 1=现金
usmart ipo apply --ipo-id <id> --apply-type 2 --quantity 1000 --cash 5000 --yes   # 2=融资，必须给 --cash
```

- `--apply-type 2`（融资）时 `--cash` 必填，CLI 会在本地先拦（退出码 3）
- `serialNo` 自动生成
- 返回的 `applyId` 是后续改单/撤单/查明细的键

## 改单 / 撤单

```bash
usmart ipo modify --apply-id <id> --quantity 200 --yes
usmart ipo modify --apply-id <id> --quantity 2000 --cash 8000 --yes    # 融资单改单要带 cash
usmart ipo cancel --apply-id <id> --yes
```

## 我的申购记录

```bash
usmart ipo records                                        # 分页
usmart ipo records --begin "2026-01-01 00:00:00" --end "2026-08-25 23:59:59"
usmart ipo record --apply-id <id>                         # 或 --serial-no
```

认购状态见 `usmart dict get ipo-apply-status`：
`1`=已认购 `4`=已撤销 `5`=已扣款 `6`=待公布中签 `7`=全部中签 `8`=部分中签 `9`=未中签 `20`=申请额度中。

## 额度不足

融资认购额度不够时，服务端会要求确认改用多少现金认购：

```bash
usmart ipo confirm-qty --apply-id <id> --cash-flag 1 --quantity 500 --confirm-by 1 --yes
usmart ipo confirm-qty --apply-id <id> --cash-flag 0 --yes      # 0=不用现金，放弃这部分
```

`--confirm-by`：`1`=IPO 认购 `2`=IPO 修改 `3`=IPO 详情修改。
