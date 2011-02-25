<% var x = 10; %>
<html>
<body>
Here's that variable:
<% for (var j = 0;j < x; j += 1) { %>
Repeated <% echo(j); %> times
<% } %>
</body>
</html>
