total_time=0
for run in {1..20};
do
	loop_time=`mocha test/ --reporter perf`
  total_time=$((loop_time + total_time))
done
echo "$total_time"
