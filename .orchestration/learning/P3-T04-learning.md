# P3-T04 learning

## L-P3T04-01: workflow ID の fixture 間再利用は query の宛先を狂わせる
runId 無しの getHandle は「最新 run」解決だが、最新 run が旧 fixture の完了済み
workflow（worker のいない task queue）である瞬間に query を投げると RPC が期限なく
block する。fixture・probe は必ず一意 workflow ID を使う。

## L-P3T04-02: cache-0 worker は sticky schedule-to-start timeout を明示的に短くする
maxCachedWorkflows=0 でも sticky queue へは配札され、既定 10s の timeout を
毎 WFT で踏む。stickyQueueScheduleToStartTimeout="1 second" で桁違いに速くなる。

## L-P3T04-03: time-skipping の auto-advance は result() 待ちだけに依存しない
期限発火を要する fixture は env.sleep(期限+margin) で明示的に時間を進める。
auto-skip は server 状態により発火しないことがある（flaky の温床）。
